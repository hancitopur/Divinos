type BrandProps = { className?: string; compact?: boolean; light?: boolean }

export function Brand({ className = '', compact = false, light = false }: BrandProps) {
  return (
    <span className={`brandmark ${compact ? 'brandmark-compact' : ''} ${light ? 'brandmark-light' : ''} ${className}`.trim()}>
      <img src={compact ? '/divinos-d.png' : '/divinos-logo.png'} alt="Divinos" />
    </span>
  )
}
