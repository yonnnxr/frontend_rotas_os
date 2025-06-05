interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
  label?: string;
  fullScreen?: boolean;
  withBackdrop?: boolean;
}

export default function Spinner({ 
  size = 'md', 
  color = 'text-blue-600', 
  className = '',
  label,
  fullScreen = false,
  withBackdrop = false
}: SpinnerProps) {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };
  
  const spinner = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg 
        className={`animate-spin ${sizeClasses[size]} ${color}`} 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && (
        <p className={`mt-2 text-sm font-medium ${color}`}>{label}</p>
      )}
    </div>
  );
  
  if (fullScreen) {
    return (
      <div className={`fixed inset-0 flex items-center justify-center z-50 ${withBackdrop ? 'bg-white/70 backdrop-blur-sm' : ''}`}>
        {spinner}
      </div>
    );
  }
  
  return spinner;
} 