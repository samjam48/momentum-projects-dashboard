type ErrorBannerProps = {
  message: string
}

export function ErrorBanner({ message }: ErrorBannerProps): JSX.Element {
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  )
}
