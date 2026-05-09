import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),   // Card slides in
      setTimeout(() => setPhase(2), 2000),  // Stagger items
      setTimeout(() => setPhase(3), 8500),  // Exit prep
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center bg-slate-50"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="w-[45%] h-full flex flex-col justify-center pl-[10vw]">
        <motion.h2 
          className="text-[4.5vw] font-black tracking-tighter text-slate-900 leading-[1.1]"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          Professionale.<br/>
          Immediato.<br/>
          <span className="gradient-text">Tuo.</span>
        </motion.h2>
      </div>

      <div className="w-[55%] h-full flex items-center justify-center">
        <motion.div 
          className="w-[35vw] bg-white rounded-xl shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col"
          initial={{ y: '20vh', opacity: 0, rotateY: -10, perspective: 1000 }}
          animate={phase >= 1 ? { y: 0, opacity: 1, rotateY: 0 } : { y: '20vh', opacity: 0, rotateY: -10 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          style={{ height: '80vh' }}
        >
          {/* Header */}
          <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tighter">PREVENTIVO</div>
              <div className="text-slate-500 mt-2 font-medium">Data: 15 Maggio 2024</div>
              <div className="text-slate-500 font-medium">Cliente: Mario Bianchi</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-800">Idraulica Rossi</div>
              <div className="text-sm text-slate-500 mt-1">Milano (MI)</div>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 flex-1 flex flex-col gap-6">
            <div className="font-bold text-slate-800 text-xl border-b border-slate-100 pb-2 flex justify-between">
              <span>Descrizione</span>
              <span>Importo</span>
            </div>

            {[
              { title: "Demolizione e smaltimento", desc: "Rimozione vecchia vasca e piastrelle", price: "€ 450,00" },
              { title: "Posa doccia e piatto", desc: "Installazione piatto doccia 120x80 e box in cristallo", price: "€ 1.150,00" },
              { title: "Rifacimento impianto idraulico", desc: "Nuove tubazioni e scarichi certificati", price: "€ 1.247,00" },
            ].map((item, i) => (
              <motion.div 
                key={i} 
                className="flex justify-between items-start"
                initial={{ opacity: 0, x: -20 }}
                animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{ duration: 0.6, delay: i * 0.2, type: 'spring' }}
              >
                <div>
                  <div className="font-bold text-slate-800 text-lg">{item.title}</div>
                  <div className="text-slate-500 text-sm">{item.desc}</div>
                </div>
                <div className="font-bold text-slate-700">{item.price}</div>
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <motion.div 
            className="p-8 bg-slate-900 text-white flex justify-between items-center"
            initial={{ y: 50, opacity: 0 }}
            animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: 50, opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <div className="text-xl font-bold text-white/80">Totale Preventivo</div>
            <div className="text-4xl font-black text-white">€ 2.847,00</div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
