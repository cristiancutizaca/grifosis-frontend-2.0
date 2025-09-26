import { motion, Variants } from 'framer-motion';
import { FC } from 'react';
import { textContainer, textVariant2 } from '../utils/motion';

interface TypingTextProps {
  title: string;
  textStyles: string;
}

export const TypingText: FC<TypingTextProps> = ({ title, textStyles }) => (
  <motion.p
    variants={textContainer}
    className={`font-extrabold lg:text-5xl text-4xl text-white ${textStyles}`}
  >
    {Array.from(title).map((letter, index) => (
      <motion.span variants={textVariant2} key={index}>
        {letter === ' ' ? '\u00A0' : letter}
      </motion.span>
    ))}
  </motion.p>
);

interface TitleTextProps {
  title: React.ReactNode;
  textStyles: string;
}

export const TitleText: FC<TitleTextProps> = ({ title, textStyles }) => (
  <motion.h2
    variants={textVariant2}
    initial="hidden"
    whileInView="show"
    className={`mt-[8px] font-bold md:text-[64px] text-[40px] text-white ${textStyles}`}
  >
    {title}
  </motion.h2>
);
