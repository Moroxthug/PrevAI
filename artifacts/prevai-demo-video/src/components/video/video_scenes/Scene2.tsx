import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);
  const text = "Ristrutturazione bagno Milano, sostituzione vasca con doccia, rifacimento impianto idraulico";

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),   // UI appears
      setTimeout(() => setPhase(2), 1500),  // Typing starts
      setTimeout(() => setPhase(3), 8500),  // Exit prep
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(20px)' }}
      transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="absolute top-[15%] text-center w-full">
        <motion.h2 
          className="text-[4vw] font-black tracking-tighter text-slate-900"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Descrivi il lavoro. In italiano.
        </motion.h2>
      </div>

      <motion.div 
        className="w-[70vw] glass-panel rounded-3xl p-8 mt-12 flex flex-col gap-6"
        initial={{ y: 100, opacity: 0, rotateX: 20, perspective: 1000 }}
        animate={phase >= 1 ? { y: 0, opacity: 1, rotateX: 0 } : { y: 100, opacity: 0, rotateX: 20 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
          <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center text-white font-bold text-xl">
            ✨
          </div>
          <div className="text-2xl font-bold text-slate-800">Nuovo Preventivo AI</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 min-h-[20vh] relative shadow-inner">
          <p className="text-[2vw] font-medium text-slate-700 leading-relaxed">
            {phase >= 2 && text.split('').map((char, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.05, delay: index * 0.04 }}
              >
                {char}
              </motion.span>
            ))}
            {phase >= 1 && (
              <motion.span 
                className="inline-block w-[3px] h-[1em] bg-primary ml-1 align-middle"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </p>

          <div className="absolute bottom-6 right-6 flex gap-4">
            <motion.div 
              className="w-14 h-14 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl"
              animate={{ scale: [1, 1.1, 1], boxShadow: ['0 0 0 rgba(0,0,0,0)', '0 4px 20px rgba(0,0,0,0.1)', '0 0 0 rgba(0,0,0,0)'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              📷
            </motion.div>
            <motion.div 
              className="w-14 h-14 rounded-full gradient-bg shadow-lg flex items-center justify-center text-white text-2xl"
              animate={{ boxShadow: ['0 0 0 rgba(124,58,237,0)', '0 0 30px rgba(124,58,237,0.6)', '0 0 0 rgba(124,58,237,0)'] }}
              transition={{ duration: 2, repeat: Infinity, delay: 1, ease: 'easeInOut' }}
            >
              ↑
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
