import * as React from 'react'

export function fixAriaHiddenOnMainWrapper(): () => void {
  if (typeof document === 'undefined') {
    return () => {}
  }

  const fixDatePickerFocusIssue = () => {
    const rdpButtons = document.querySelectorAll('.rdp-button, .rdp-button_reset')
    const mainWrapper = document.querySelector('.w-full.max-w-\\[95vw\\].mx-auto.px-4.md\\:px-8')

    if (rdpButtons.length > 0 && mainWrapper) {
      if (mainWrapper.getAttribute('aria-hidden') === 'true') {
        mainWrapper.removeAttribute('aria-hidden')
      }

      rdpButtons.forEach(button => {
        let parent = button.parentElement
        while (parent) {
          if (parent.getAttribute('aria-hidden') === 'true') {
            parent.removeAttribute('aria-hidden')
            parent.setAttribute('inert', '')
          }
          parent = parent.parentElement
        }
      })
    }
  }

  const selectorsThatShouldNotBeHidden = [
    '.w-full.max-w-\\[95vw\\].mx-auto.px-4.md\\:px-8',
    '[data-no-aria-hidden="true"]',
    '[role="dialog"]',
    '.rdp',
    '.rdp-button',
    '.rdp-button_reset',
  ]

  const fixElementsMatching = () => {
    selectorsThatShouldNotBeHidden.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        if (element.getAttribute('aria-hidden') === 'true') {
          element.removeAttribute('aria-hidden')
          element.setAttribute('inert', '')
        }

        let parent = element.parentElement
        while (parent) {
          if (parent.getAttribute('aria-hidden') === 'true') {
            parent.removeAttribute('aria-hidden')
            parent.setAttribute('inert', '')
          }
          parent = parent.parentElement
        }
      })
    })

    document.querySelectorAll('[aria-hidden="true"]').forEach(hiddenElement => {
      if (hiddenElement.contains(document.activeElement) && document.activeElement !== document.body) {
        hiddenElement.removeAttribute('aria-hidden')
        hiddenElement.setAttribute('inert', '')
      }
    })
  }

  fixElementsMatching()
  fixDatePickerFocusIssue()

  const directlyObserveMainWrapper = () => {
    const mainWrapper = document.querySelector('.w-full.max-w-\\[95vw\\].mx-auto.px-4.md\\:px-8')
    if (mainWrapper) {
      if (mainWrapper.getAttribute('aria-hidden') === 'true') {
        mainWrapper.removeAttribute('aria-hidden')
      }

      const wrapperObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
            if (mainWrapper.getAttribute('aria-hidden') === 'true') {
              mainWrapper.removeAttribute('aria-hidden')
            }
          }
        })
      })

      wrapperObserver.observe(mainWrapper, {
        attributes: true,
        attributeFilter: ['aria-hidden'],
      })

      return wrapperObserver
    }
    return null
  }

  const wrapperObserver = directlyObserveMainWrapper()

  const observer = new MutationObserver((mutations) => {
    let shouldFix = false

    mutations.forEach(mutation => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
        shouldFix = true
      } else if (mutation.type === 'childList') {
        shouldFix = true
      }
    })

    if (shouldFix) {
      fixElementsMatching()
      fixDatePickerFocusIssue()
    }
  })

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['aria-hidden'],
    childList: true,
    subtree: true,
  })

  const handleFocusChange = () => {
    if (document.activeElement && document.activeElement !== document.body) {
      if (document.activeElement.closest('.rdp-button, .rdp-button_reset, .rdp')) {
        fixDatePickerFocusIssue()
      }

      fixElementsMatching()
    }
  }

  document.addEventListener('focusin', handleFocusChange)

  const intervalId = setInterval(() => {
    if (document.querySelector('.rdp-button, .rdp-button_reset')) {
      fixDatePickerFocusIssue()
    }
  }, 500)

  return () => {
    observer.disconnect()
    if (wrapperObserver) wrapperObserver.disconnect()
    document.removeEventListener('focusin', handleFocusChange)
    clearInterval(intervalId)
  }
}

export function useAccessibilityFixes() {
  React.useEffect(() => {
    return fixAriaHiddenOnMainWrapper()
  }, [])
}

export const replaceAriaHiddenWithInert = (element: HTMLElement): void => {
  if (!element) return

  if (element.hasAttribute('aria-hidden')) {
    const isHidden = element.getAttribute('aria-hidden') === 'true'

    element.removeAttribute('aria-hidden')

    if (isHidden) {
      element.setAttribute('inert', '')
    } else {
      element.removeAttribute('inert')
    }
  }
}

export const setupAriaHiddenObserver = (rootElement: HTMLElement): MutationObserver | null => {
  if (!rootElement) return null

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
        const element = mutation.target as HTMLElement
        replaceAriaHiddenWithInert(element)
      }
    })
  })

  observer.observe(rootElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ['aria-hidden'],
  })

  return observer
}
