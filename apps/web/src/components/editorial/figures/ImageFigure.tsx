/**
 * Audio XX — ImageFigure primitive.
 *
 * Renders an Editorial Figure of kind 'image' — a single image with
 * magazine-style caption, photographer/source credit, and optional
 * link to the original asset page (typically a Wikimedia file page or
 * museum collection record).
 *
 * The image is the explanatory artifact; the caption is the editorial
 * payload. Caption discipline (per the doctrine): the caption answers
 * what the reader is seeing, why it mattered historically, and why it
 * remains relevant. The credit appears in a separate, muted line below
 * the caption — distinct from the caption itself so the editorial
 * voice is not entangled with attribution.
 *
 * Pure presentation. Server-component-safe.
 */

import React from 'react';
import { COLOR } from '@/lib/editorial-tokens';
import { EditorialFigureFrame } from './EditorialFigureFrame';

interface ImageFigureProps {
  figure: {
    kind: 'image';
    image: {
      url: string;
      caption: string;
      credit: string;
      sourceUrl?: string;
      alt?: string;
    };
  };
  /** Optional explicit title override; otherwise the frame ships untitled. */
  title?: string;
}

export function ImageFigure({ figure, title }: ImageFigureProps) {
  const { image } = figure;
  return (
    <EditorialFigureFrame title={title} caption={image.caption}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.5rem 0',
        }}
      >
        <img
          src={image.url}
          alt={image.alt ?? image.caption}
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{
            maxWidth: '100%',
            maxHeight: '420px',
            objectFit: 'contain',
            display: 'block',
            borderRadius: '4px',
          }}
        />
      </div>
      <p
        style={{
          marginTop: '0.45rem',
          marginBottom: 0,
          fontSize: '0.72rem',
          color: COLOR.textMuted,
          textAlign: 'right',
        }}
      >
        Image:{' '}
        {image.sourceUrl ? (
          <a
            href={image.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: COLOR.textMuted, textDecoration: 'underline', textUnderlineOffset: '2px' }}
          >
            {image.credit}
          </a>
        ) : (
          image.credit
        )}
      </p>
    </EditorialFigureFrame>
  );
}
