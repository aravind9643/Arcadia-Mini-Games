import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'
import { cue } from '../lib/feedback'
import { cx } from '../lib/utils'
import { Icon, type IconName } from './Icon'
import './ui.css'

/* ---------------- Button ---------------- */

type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: 'primary' | 'ghost' | 'surface' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  full?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'surface',
  size = 'md',
  icon,
  full,
  children,
  className,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      className={cx('btn', `btn--${variant}`, `btn--${size}`, full && 'btn--full', className)}
      whileTap={{ scale: 0.955 }}
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 30 }}
      onClick={(e) => {
        cue('tap')
        onClick?.(e)
      }}
      {...rest}
    >
      {icon && <span className="btn__icon">{icon}</span>}
      {children}
    </motion.button>
  )
}

/* ---------------- IconButton ---------------- */

export function IconButton({
  label,
  children,
  onClick,
  className,
  ...rest
}: Omit<HTMLMotionProps<'button'>, 'children'> & { label: string; children?: ReactNode }) {
  return (
    <motion.button
      aria-label={label}
      className={cx('iconbtn', className)}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.06 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      onClick={(e) => {
        cue('tap')
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

/* ---------------- Stat ---------------- */

export function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: ReactNode
  accent?: boolean
}) {
  return (
    <div className={cx('stat', accent && 'stat--accent')}>
      <span className="stat__label">{label}</span>
      <span className="stat__value mono">{value}</span>
    </div>
  )
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="statrow">{children}</div>
}

/* ---------------- Section heading ---------------- */

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="sectiontitle">
      <h2>{children}</h2>
      {action}
    </div>
  )
}

/* ---------------- Toggle ---------------- */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  icon,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
  icon?: IconName
}) {
  return (
    <button
      className="toggle"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        cue('tap')
        onChange(!checked)
      }}
    >
      {icon && (
        <span className="toggle__icon">
          <Icon name={icon} size={19} />
        </span>
      )}
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        {hint && <span className="toggle__hint">{hint}</span>}
      </span>
      <span className={cx('toggle__track', checked && 'is-on')}>
        <motion.span
          className="toggle__knob"
          layout
          transition={{ type: 'spring', stiffness: 640, damping: 34 }}
        />
      </span>
    </button>
  )
}

/* ---------------- Empty state ---------------- */

export function Empty({
  icon,
  title,
  children,
}: {
  icon: IconName
  title: string
  children?: ReactNode
}) {
  return (
    <motion.div
      className="empty card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span className="empty__icon">
        <Icon name={icon} size={30} weight={1.7} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </motion.div>
  )
}
