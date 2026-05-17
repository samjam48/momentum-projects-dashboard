type LoadingStateProps = {
  message: string
}

export function LoadingState({ message }: LoadingStateProps): JSX.Element {
  return <p className="muted-copy">{message}</p>
}
