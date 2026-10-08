import { CREDITS } from './library';

/** The credit line some of the picture collections ask for wherever their pictures are shown. */
export default function PictureCredits() {
  return (
    <p className="picture-credits">
      Pictures:{' '}
      {CREDITS.map((c, i) => (
        <span key={c.name}>
          <a href={c.url} target="_blank" rel="noreferrer">
            {c.name}
          </a>{' '}
          ({c.licence}){i < CREDITS.length - 1 ? ' · ' : '.'}
        </span>
      ))}
    </p>
  );
}
