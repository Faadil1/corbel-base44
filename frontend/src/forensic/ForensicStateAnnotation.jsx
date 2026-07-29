import React from "react";

/**
 * ForensicStateAnnotation — state word + status sentence (right rail, top).
 * Renders previous and next content stacked; a channel-driven crossfade
 * (annoPrev out, annoNext in) reveals the new authoritative state.
 *
 * Props:
 *  - prevText, nextText: { word, qualifier, sentence, affectedLabel }
 *  - annoPrev, annoNext: 0..1
 */
function Layer({ tx }) {
  return (
    <div className="fl-state-anno-layer">
      <div className="fl-state-word">{tx.word}</div>
      {tx.qualifier ? <div className="fl-state-qual">{tx.qualifier}</div> : null}
      {tx.affectedLabel ? <div className="fl-state-affected">Affected: {tx.affectedLabel}</div> : null}
      <div className="fl-state-sentence">{tx.sentence}</div>
    </div>
  );
}

export default function ForensicStateAnnotation({ prevText, nextText, annoPrev, annoNext }) {
  return (
    <div className="fl-state-anno" aria-live="off">
      <div className="fl-state-anno-prev fl-anim-opacity" style={{ opacity: annoPrev ?? 0 }}>
        <Layer tx={prevText} />
      </div>
      <div className="fl-state-anno-next fl-anim-opacity" style={{ opacity: annoNext ?? 1 }}>
        <Layer tx={nextText} />
      </div>
    </div>
  );
}
