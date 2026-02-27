import { forwardRef } from 'react'
import { useNavigate } from '@/context/navigation-provider'

type NavLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  function NavLink({ to, onClick, children, ...props }, ref) {
    const navigate = useNavigate()

    return (
      <a
        ref={ref}
        href={to}
        onClick={(e) => {
          e.preventDefault()
          navigate(to)
          onClick?.(e)
        }}
        {...props}
      >
        {children}
      </a>
    )
  }
)
