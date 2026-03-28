import { it } from 'vitest';
import { detectIntent } from '../intent';
import { routeConversation, resolveMode } from '../conversation-router';
import type { ConversationMode } from '../conversation-router';

it('routing trace for shopping refinement turns', () => {
  const turns = [
    'i like van halen',
    'speakers',
    'starting from scratch',
    '5000',
    'large living room',
    'i want big scale',
    'what about amps? same budget',
    "i don't want tubes",
    'i want new',
    'class ab amps',
  ];

  let priorMode: ConversationMode | undefined = undefined;

  for (const t of turns) {
    const { intent } = detectIntent(t);
    const routedMode = routeConversation(t);
    const effectiveMode = resolveMode(routedMode, priorMode);

    // After mode override at line 1276
    let finalIntent = intent;
    if (effectiveMode === 'shopping' && intent !== 'shopping' && intent !== 'product_assessment') {
      finalIntent = 'shopping';
    }
    if (effectiveMode === 'diagnosis' && intent !== 'comparison' && intent !== 'gear_inquiry' && intent !== 'system_assessment') {
      finalIntent = 'diagnosis';
    }

    console.log(
      `"${t}" → routedMode=${routedMode}, priorMode=${priorMode ?? 'none'}, effectiveMode=${effectiveMode}, intent=${intent}, finalIntent=${finalIntent}`
    );

    priorMode = effectiveMode;
  }
});
