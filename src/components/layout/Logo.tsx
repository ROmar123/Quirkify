import { motion } from 'motion/react';

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`flex items-center overflow-hidden ${className}`}
      style={{ width: 180, height: 64 }}
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <img
        src="/logo.png"
        alt="Quirkify"
        style={{
          width: 260,
          height: 'auto',
          marginLeft: -30,
          marginTop: 10,
        }}
        className="object-contain"
      />
    </motion.div>
  );
}
