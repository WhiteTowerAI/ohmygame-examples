import { journalSpecies } from '../gameplay/journal/journal-config';
import type { FieldJournal, JournalPhoto } from '../gameplay/journal/field-journal';

const starText = (stars: number, max = 3) => '★'.repeat(stars) + '☆'.repeat(max - stars);
const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const photoFigure = (photo: JournalPhoto) => {
  const figure = element('figure');
  const image = element('img');
  image.src = photo.src;
  image.alt = `${photo.speciesName}, ${photo.stateLabel}`;
  const caption = element('figcaption');
  if (photo.rating.stars > 0) {
    caption.append(
      element('strong', undefined, `${photo.speciesName} · ${photo.stateLabel}`),
      element('span', 'stars', starText(photo.rating.stars)),
    );
  } else {
    caption.append(element('strong', undefined, 'Species unclear'), element('span', undefined, 'Not counted'));
  }
  figure.append(image, caption);
  return figure;
};

type JournalViewElements = Readonly<{
  progressTitle: HTMLElement;
  stats: HTMLElement;
  checklist: HTMLElement;
  photoGrid: HTMLElement;
  photoEmpty: HTMLElement;
  toggleCount: HTMLOutputElement;
}>;

export const renderJournal = (elements: JournalViewElements, journal: FieldJournal) => {
  const progress = journal.getProgress();
  elements.toggleCount.value = `${progress.found}/${progress.total}`;
  elements.progressTitle.textContent = `${progress.found} of ${progress.total} behaviours recorded`;
  elements.stats.replaceChildren(
    element('span', undefined, `★ ${progress.stars} / ${progress.maxStars}`),
    element('span', undefined, plural(progress.photos, 'photo')),
    element('span', undefined, `${plural(progress.startled, 'bird')} startled`),
  );

  const entries = journal.getEntries();
  elements.checklist.replaceChildren(...journalSpecies.map((species) => {
    const section = element('section', 'journal-species');
    const speciesEntries = entries.filter(({ definition }) => definition.speciesId === species.id);
    const found = speciesEntries.filter(({ best }) => best).length;
    section.append(element('h3', undefined, `${species.name} · ${found}/${speciesEntries.length}`));
    const list = element('ul', 'journal-entries');
    speciesEntries.forEach(({ definition, best }) => {
      const item = element('li', best ? 'found' : 'missing');
      const thumb = element('div', 'journal-thumb');
      if (best) {
        const image = element('img');
        image.src = best.src;
        image.alt = '';
        thumb.append(image);
      } else {
        thumb.textContent = '?';
      }
      const text = element('div', 'journal-entry-text');
      text.append(
        element('strong', undefined, definition.title + (definition.rare ? ' · rare' : '')),
        element('span', best ? 'stars' : undefined, best ? starText(best.rating.stars) : definition.hint),
      );
      item.append(thumb, text);
      list.append(item);
    });
    section.append(list);
    return section;
  }));

  const photos = journal.getPhotos();
  elements.photoEmpty.hidden = photos.length > 0;
  elements.photoGrid.replaceChildren(...[...photos].reverse().map(photoFigure));
};

type SummaryElements = Readonly<{
  root: HTMLElement;
  kicker: HTMLElement;
  title: HTMLElement;
  stats: HTMLElement;
  photos: HTMLElement;
}>;

export const renderSummary = (
  elements: SummaryElements,
  journal: FieldJournal,
  elapsedSeconds: number,
) => {
  const progress = journal.getProgress();
  elements.kicker.textContent = progress.complete ? 'Journal complete!' : 'Session complete';
  elements.title.textContent = progress.rank;
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = Math.floor(elapsedSeconds % 60).toString().padStart(2, '0');
  const rows: [string, string][] = [
    ['Behaviours recorded', `${progress.found} / ${progress.total}`],
    ['Stars', `${progress.stars} / ${progress.maxStars}`],
    ['Photos taken', `${progress.photos} (${progress.identifiedPhotos} identified)`],
    ['Birds startled', String(progress.startled)],
    ['Time in the park', `${minutes}:${seconds}`],
  ];
  elements.stats.replaceChildren(...rows.flatMap(([label, value]) => [
    element('dt', undefined, label),
    element('dd', undefined, value),
  ]));
  const best = journal.getEntries()
    .flatMap(({ best: photo }) => (photo ? [photo] : []))
    .sort((left, right) => right.rating.stars - left.rating.stars)
    .slice(0, 3);
  elements.photos.replaceChildren(...best.map(photoFigure));
  elements.photos.hidden = best.length === 0;
};
