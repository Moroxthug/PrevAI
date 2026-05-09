import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const CAPITOLI = [
  {
    lettera: 'A',
    titolo: 'Demolizione e smaltimento',
    voci: [
      { descrizione: 'Rimozione rivestimenti ceramici esistenti', um: 'mq', qta: 18, pu: 12.00 },
      { descrizione: 'Smaltimento macerie a discarica autorizzata', um: 'mc', qta: 1.5, pu: 85.00 },
    ],
  },
  {
    lettera: 'B',
    titolo: 'Posa doccia e sanitari',
    voci: [
      { descrizione: 'Posa piatto doccia 100×80 antiscivolo', um: 'cad', qta: 1, pu: 320.00 },
      { descrizione: 'Box doccia cristallo 8mm con profilo cromo', um: 'cad', qta: 1, pu: 580.00 },
      { descrizione: 'Fornitura e posa sanitari sospesi completi', um: 'cad', qta: 1, pu: 490.00 },
    ],
  },
  {
    lettera: 'C',
    titolo: 'Rifacimento impianto idraulico',
    voci: [
      { descrizione: 'Nuove tubazioni in multistrato a incasso', um: 'ml', qta: 14, pu: 28.50 },
      { descrizione: 'Rubinetteria miscelatore serie cromata', um: 'cad', qta: 2, pu: 145.00 },
      { descrizione: 'Collaudo e certificazione conformità', um: 'cad', qta: 1, pu: 180.00 },
    ],
  },
];

function totaleCapitolo(cap: typeof CAPITOLI[0]) {
  return cap.voci.reduce((s, v) => s + v.qta * v.pu, 0);
}

const IMPONIBILE = CAPITOLI.reduce((s, c) => s + totaleCapitolo(c), 0);
const IVA = IMPONIBILE * 0.22;
const TOTALE = IMPONIBILE + IVA;

function fmt(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 700),   // card slides in
      setTimeout(() => setPhase(2), 1600),  // header appears
      setTimeout(() => setPhase(3), 2400),  // capitoli stagger in
      setTimeout(() => setPhase(4), 6500),  // totale row
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-stretch"
      style={{ background: '#f8fafc' }}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Left: headline */}
      <div className="w-[38%] flex flex-col justify-center pl-[8vw] pr-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2
            className="font-black tracking-tighter text-slate-900 leading-[1.05]"
            style={{ fontSize: '4vw' }}
          >
            Professionale.<br />
            Immediato.<br />
            <span className="gradient-text">Tuo.</span>
          </h2>
          <motion.p
            className="text-slate-500 mt-4 font-medium"
            style={{ fontSize: '1.3vw' }}
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : {}}
            transition={{ duration: 0.6 }}
          >
            Capitoli, voci, prezzi unitari.<br />
            Tutto pronto in 30 secondi.
          </motion.p>
        </motion.div>
      </div>

      {/* Right: real quote card */}
      <div className="w-[62%] flex items-center justify-center py-6 pr-[6vw]">
        <motion.div
          className="w-full bg-white rounded-2xl overflow-hidden flex flex-col"
          style={{
            maxWidth: '38vw',
            height: '85vh',
            boxShadow: '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
          }}
          initial={{ y: '25vh', opacity: 0, rotateY: -8 }}
          animate={phase >= 1 ? { y: 0, opacity: 1, rotateY: 0 } : {}}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
        >
          {/* Quote header */}
          <motion.div
            className="px-6 pt-6 pb-4 flex justify-between items-start"
            style={{ borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : {}}
            transition={{ duration: 0.5 }}
          >
            <div>
              <div
                className="font-black tracking-tighter text-slate-900"
                style={{ fontSize: '1.3vw' }}
              >
                PREVENTIVO N. 2024-047
              </div>
              <div style={{ fontSize: '0.85vw', color: '#64748b', marginTop: 4 }}>
                Data: 15 maggio 2025
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: '0.75vw', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Committente</div>
                <div style={{ fontSize: '0.9vw', color: '#1e293b', fontWeight: 600, marginTop: 2 }}>Mario Bianchi</div>
                <div style={{ fontSize: '0.78vw', color: '#64748b' }}>Via Garibaldi 12, Milano (MI)</div>
              </div>
            </div>
            <div className="text-right">
              {/* Logo placeholder */}
              <div
                className="rounded-xl flex items-center justify-center mb-2 ml-auto"
                style={{
                  width: '5vw', height: '2.5vw',
                  background: 'linear-gradient(135deg, #7C3AED20, #06B6D420)',
                  border: '1px solid #e2e8f0',
                }}
              >
                <span style={{ fontSize: '0.6vw', color: '#7C3AED', fontWeight: 700, letterSpacing: '0.05em' }}>LOGO</span>
              </div>
              <div style={{ fontSize: '0.95vw', fontWeight: 700, color: '#1e293b' }}>Idraulica Rossi S.r.l.</div>
              <div style={{ fontSize: '0.75vw', color: '#64748b' }}>P.IVA 02345678901</div>
              <div style={{ fontSize: '0.75vw', color: '#64748b' }}>Via Roma 8, Milano (MI)</div>
            </div>
          </motion.div>

          {/* Capitoli */}
          <div className="flex-1 overflow-hidden px-6 py-4 flex flex-col gap-3">
            {CAPITOLI.map((cap, ci) => (
              <motion.div
                key={cap.lettera}
                initial={{ opacity: 0, x: -16 }}
                animate={phase >= 3 ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: ci * 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Chapter header */}
                <div
                  className="flex items-center gap-2 mb-2"
                  style={{ paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}
                >
                  <div
                    className="rounded-lg flex items-center justify-center font-black"
                    style={{
                      width: '1.6vw', height: '1.6vw', fontSize: '0.75vw',
                      background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {cap.lettera}
                  </div>
                  <span style={{ fontSize: '0.85vw', fontWeight: 700, color: '#1e293b' }}>
                    {cap.titolo}
                  </span>
                  <span style={{ fontSize: '0.75vw', color: '#94a3b8', marginLeft: 'auto', fontWeight: 600 }}>
                    € {fmt(totaleCapitolo(cap))}
                  </span>
                </div>

                {/* Voci */}
                <div className="flex flex-col gap-1 pl-1">
                  {cap.voci.map((v, vi) => (
                    <motion.div
                      key={vi}
                      className="flex items-start justify-between gap-2"
                      initial={{ opacity: 0 }}
                      animate={phase >= 3 ? { opacity: 1 } : {}}
                      transition={{ delay: ci * 0.18 + vi * 0.09 + 0.15 }}
                    >
                      <span style={{ fontSize: '0.72vw', color: '#475569', flex: 1 }}>{v.descrizione}</span>
                      <span style={{ fontSize: '0.68vw', color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 8 }}>
                        {v.qta} {v.um} × € {fmt(v.pu)}
                      </span>
                      <span style={{ fontSize: '0.72vw', color: '#334155', fontWeight: 600, minWidth: '3.5vw', textAlign: 'right' }}>
                        € {fmt(v.qta * v.pu)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Totali footer */}
          <motion.div
            style={{ borderTop: '1px solid #f1f5f9' }}
            initial={{ opacity: 0, y: 16 }}
            animate={phase >= 4 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Subtotals */}
            <div className="px-6 py-3 flex flex-col gap-1" style={{ background: '#fafafa' }}>
              <div className="flex justify-between">
                <span style={{ fontSize: '0.8vw', color: '#64748b' }}>Imponibile</span>
                <span style={{ fontSize: '0.8vw', color: '#334155', fontWeight: 600 }}>€ {fmt(IMPONIBILE)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ fontSize: '0.8vw', color: '#64748b' }}>IVA 22%</span>
                <span style={{ fontSize: '0.8vw', color: '#334155', fontWeight: 600 }}>€ {fmt(IVA)}</span>
              </div>
            </div>
            {/* Grand total */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5, #06B6D4)' }}
            >
              <span style={{ fontSize: '1vw', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                Totale Preventivo
              </span>
              <motion.span
                style={{ fontSize: '1.8vw', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={phase >= 4 ? { scale: 1, opacity: 1 } : {}}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
              >
                € {fmt(TOTALE)}
              </motion.span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
