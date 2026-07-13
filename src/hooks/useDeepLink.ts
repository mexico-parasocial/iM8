import {useEffect, useState} from 'react'
import {Linking} from 'react-native'

export type DeepLinkRoute =
  | 'wallet'
  | 'verification'
  | 'identity'
  | 'settings'
  | null

function parseRoute(url: string): DeepLinkRoute {
  try {
    const parsed = new URL(url)
    const scheme = parsed.protocol.replace(/:$/, '')
    if (scheme !== 'im8') return null
    const path = parsed.hostname || parsed.pathname.replace(/^\/+/, '')
    switch (path) {
      case 'wallet':
      case 'verification':
      case 'identity':
      case 'settings':
        return path
      default:
        return null
    }
  } catch {
    return null
  }
}

export function useDeepLink(): {
  route: DeepLinkRoute
  clear: () => void
} {
  const [route, setRoute] = useState<DeepLinkRoute>(null)

  useEffect(() => {
    function handle(event: {url: string}) {
      setRoute(parseRoute(event.url))
    }

    Linking.getInitialURL().then(url => {
      if (url) setRoute(parseRoute(url))
    })

    const subscription = Linking.addEventListener('url', handle)
    return () => subscription.remove()
  }, [])

  return {route, clear: () => setRoute(null)}
}
