import { useNavigate } from '@/context/use-navigation'

type NavLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> & {
  to: string
  ref?: React.Ref<HTMLAnchorElement>
}

export function NavLink({
  to,
  ref,
  onClick,
  children,
  ...props
}: NavLinkProps) {
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
