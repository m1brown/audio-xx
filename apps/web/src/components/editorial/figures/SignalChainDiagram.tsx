/**
 * Audio XX — SignalChainDiagram primitive.
 *
 * Renders an Editorial Figure of kind 'signal-chain' — an ordered
 * chain of labeled nodes, drawn as a horizontal sequence on desktop
 * and a vertical stack on narrow viewports. Each node is a labeled
 * box; arrows between adjacent nodes use a single arrow glyph
 * styled into the layout.
 *
 * Implementation choice: flex-row of HTML divs (NOT inline SVG) so
 * the chain reflows automatically on narrow viewports without media-
 * query JavaScript or SVG viewBox arithmetic. The visual is austere
 * by design — borders use COLOR.border, body uses COLOR.cardBg, text
 * uses proseStyle. Magazine-style restraint, not infographic chrome.
 *
 * Caption discipline (per the doctrine): the caption explains the
 * EDITORIAL CLAIM the chain makes, not just what the chain is. For
 * the SET system chain this is "SET is usually part of a broader
 * low-power system philosophy in which source, amplification, and
 * loudspeaker sensitivity are selected together rather than
 * independently."
 *
 * The component is parameterised — the same primitive renders any
 * future signal-chain figure (NOS DAC chain, R2R DAC chain, SUT
 * chain, etc.) by varying the `nodes` array. The visual language
 * established by the SET pilot is the language all future chains
 * inherit.
 *
 * Pure presentation. Server-component-safe.
 */

import React from 'react';
import { COLOR } from '@/lib/editorial-tokens';
import { EditorialFigureFrame } from './EditorialFigureFrame';

interface SignalChainDiagramProps {
  figure: {
    kind: 'signal-chain';
    title?: string;
    caption: string;
    nodes: Array<{
      label: string;
      sublabel?: string;
    }>;
  };
}

export function SignalChainDiagram({ figure }: SignalChainDiagramProps) {
  const { title, caption, nodes } = figure;

  return (
    <EditorialFigureFrame title={title} caption={caption}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: '0.4rem',
          padding: '0.5rem 0',
        }}
      >
        {nodes.map((node, i) => (
          <React.Fragment key={i}>
            <div
              role="group"
              aria-label={node.sublabel ? `${node.label} — ${node.sublabel}` : node.label}
              style={{
                flex: '1 1 130px',
                minWidth: '130px',
                maxWidth: '200px',
                padding: '0.65rem 0.55rem',
                background: '#FFFEFA',
                border: `1px solid ${COLOR.border}`,
                borderRadius: '6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: COLOR.textPrimary,
                  lineHeight: 1.25,
                }}
              >
                {node.label}
              </p>
              {node.sublabel && (
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.72rem',
                    color: COLOR.textMuted,
                    fontStyle: 'italic',
                    lineHeight: 1.3,
                  }}
                >
                  {node.sublabel}
                </p>
              )}
            </div>
            {i < nodes.length - 1 && (
              <div
                aria-hidden="true"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLOR.textMuted,
                  fontSize: '1rem',
                  minWidth: '14px',
                  // The chain arrow renders horizontally; when nodes
                  // wrap to a new row the arrow naturally hides between
                  // a row boundary. For a fully vertical narrow-screen
                  // stack the arrows still read correctly as separator
                  // glyphs.
                }}
              >
                →
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </EditorialFigureFrame>
  );
}
