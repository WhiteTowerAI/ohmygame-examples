import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webpInfo } from './image';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJSON = <T>(path: string): T => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
type Reference = { type: 'node' | 'library'; nodeId?: string; assetId?: string };
type Asset = { name: string; path: string };
type Index = { boards: { id: string; name: string }[]; documents: { id: string; title: string }[]; mainDocumentId?: string };
type Board = {
  id: string;
  editorLayout?: unknown;
  nodes: { id: string; type: string; data: { assetId?: string; documentId?: string; promptSource?: Reference; images?: Reference[]; references?: Reference[]; source?: Reference } }[];
  edges: { source: string; target: string }[];
};
type Layout = { nodes: Record<string, { x: number; y: number }>; viewport: { x: number; y: number; zoom: number }; view: string };

test('original Canvas keeps valid design, asset and node references with separate layouts', () => {
  const index = readJSON<Index>('canvas/index.json');
  const assets = readJSON<{ assets: Record<string, Asset> }>('canvas/assets.json').assets;
  assert.equal(new Set(index.boards.map(board => board.id)).size, index.boards.length);
  const documents = new Set(index.documents.map(document => document.id));
  assert.equal(documents.size, index.documents.length);
  assert(index.mainDocumentId && documents.has(index.mainDocumentId));
  for (const id of documents) assert(existsSync(resolve(root, `canvas/documents/${id}.md`)), id);
  const referencedAssets = new Set<string>();
  for (const entry of index.boards) {
    const board = readJSON<Board>(`canvas/boards/${entry.id}.json`);
    const layout = readJSON<Layout>(`canvas/editor/${entry.id}.json`);
    assert.equal(board.id, entry.id);
    assert.equal(board.editorLayout, undefined);
    const ids = new Set(board.nodes.map(node => node.id));
    assert.equal(ids.size, board.nodes.length);
    const checkReference = (reference: Reference) => {
      if (reference.type === 'node') assert(reference.nodeId && ids.has(reference.nodeId), reference.nodeId);
      else {
        assert(reference.assetId && assets[reference.assetId], reference.assetId);
        referencedAssets.add(reference.assetId);
      }
    };
    for (const node of board.nodes) {
      if (node.data.assetId) {
        assert(assets[node.data.assetId], node.data.assetId);
        referencedAssets.add(node.data.assetId);
      }
      if (node.data.documentId) assert(documents.has(node.data.documentId), node.data.documentId);
      for (const reference of [...(node.data.images ?? []), ...(node.data.references ?? [])]) checkReference(reference);
      if (node.data.promptSource) checkReference(node.data.promptSource);
      if (node.data.source) checkReference(node.data.source);
      assert(layout.nodes[node.id], `Position: ${node.id}`);
    }
    for (const edge of board.edges) assert(ids.has(edge.source) && ids.has(edge.target));
    for (const [id, position] of Object.entries(layout.nodes)) {
      assert(ids.has(id), `Stale layout node: ${id}`);
      assert(Number.isFinite(position.x) && Number.isFinite(position.y), id);
    }
    assert.equal(layout.view, 'canvas');
    assert(Number.isFinite(layout.viewport.x) && Number.isFinite(layout.viewport.y) && layout.viewport.zoom > 0);
  }
  assert(referencedAssets.size > 0);
});

test('case Canvas is self-contained and its design illustration resolves without Library access', () => {
  const assets = readJSON<{ assets: Record<string, Asset> }>('canvas/assets.json').assets;
  for (const [id, asset] of Object.entries(assets)) {
    const path = relative(root, resolve(root, asset.path));
    assert(path && !path.startsWith('..') && !isAbsolute(path), id);
    assert(asset.name.length > 0);
    assert(readFileSync(resolve(root, asset.path)).length > 0, id);
  }
  const jobs = readJSON<{ id: string; status: string }[]>('canvas/jobs.json');
  assert.equal(jobs.length, 1, 'Keep the original cover-generation record');
  assert.equal(jobs[0]!.status, 'succeeded');
  const index = readJSON<Index>('canvas/index.json');
  const document = readFileSync(resolve(root, `canvas/documents/${index.mainDocumentId}.md`), 'utf8');
  assert(document.startsWith('# Circuit Craftsman Game Design Document'));
  assert(document.includes('../../assets/concept.webp'));
  assert(!document.includes('assets/generated/'));
  assert.equal(webpInfo(readFileSync(resolve(root, 'assets/concept.webp'))).width, 1280);
});
