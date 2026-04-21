import { useEffect, useState } from 'react'

type TooltipPosition = {
  x: number
  y: number
}

const SHOW_DELAY_MS = 0
const CURSOR_OFFSET_X = 12
const CURSOR_OFFSET_Y = 16

function GlobalTooltip() {
  const [content, setContent] = useState('')
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0 })

  useEffect(() => {
    let activeTarget: HTMLElement | null = null
    let showTimer: number | null = null

    const clearShowTimer = () => {
      if (showTimer !== null) {
        window.clearTimeout(showTimer)
        showTimer = null
      }
    }

    const restoreNativeTitle = (element: HTMLElement | null) => {
      if (!element) {
        return
      }

      const originalTitle = element.dataset.tooltipOriginalTitle
      if (originalTitle !== undefined) {
        element.setAttribute('title', originalTitle)
        delete element.dataset.tooltipOriginalTitle
      }
    }

    const hideTooltip = () => {
      clearShowTimer()
      setIsVisible(false)
      setContent('')
      restoreNativeTitle(activeTarget)
      activeTarget = null
    }

    const updateTooltipPosition = (x: number, y: number) => {
      setPosition({
        x: x + CURSOR_OFFSET_X,
        y: y + CURSOR_OFFSET_Y,
      })
    }

    const getTitleFromElement = (element: HTMLElement): string | null => {
      const existingTitle = element.getAttribute('title')

      if (existingTitle && existingTitle.trim()) {
        element.dataset.tooltipOriginalTitle = existingTitle
        element.removeAttribute('title')
        return existingTitle
      }

      const cachedTitle = element.dataset.tooltipOriginalTitle
      if (cachedTitle && cachedTitle.trim()) {
        return cachedTitle
      }

      return null
    }

    const showForElement = (element: HTMLElement, x: number, y: number) => {
      const title = getTitleFromElement(element)
      if (!title) {
        hideTooltip()
        return
      }

      if (activeTarget && activeTarget !== element) {
        restoreNativeTitle(activeTarget)
      }

      activeTarget = element
      clearShowTimer()
      setContent(title)
      updateTooltipPosition(x, y)
      showTimer = window.setTimeout(() => {
        setIsVisible(true)
      }, SHOW_DELAY_MS)
    }

    const getTooltipElement = (eventTarget: EventTarget | null): HTMLElement | null => {
      if (!(eventTarget instanceof Element)) {
        return null
      }

      return eventTarget.closest('[title], [data-tooltip-original-title]') as HTMLElement | null
    }

    const handlePointerOver = (event: MouseEvent) => {
      const element = getTooltipElement(event.target)
      if (!element) {
        return
      }

      showForElement(element, event.clientX, event.clientY)
    }

    const handlePointerMove = (event: MouseEvent) => {
      if (!activeTarget) {
        return
      }

      updateTooltipPosition(event.clientX, event.clientY)
    }

    const handlePointerOut = (event: MouseEvent) => {
      if (!activeTarget) {
        return
      }

      const nextElement = getTooltipElement(event.relatedTarget)
      if (nextElement === activeTarget) {
        return
      }

      hideTooltip()
    }

    const handleFocusIn = (event: FocusEvent) => {
      const element = getTooltipElement(event.target)
      if (!element) {
        return
      }

      const rect = element.getBoundingClientRect()
      showForElement(element, rect.left + rect.width / 2, rect.top)
    }

    const handleFocusOut = (event: FocusEvent) => {
      if (!activeTarget) {
        return
      }

      const nextElement = getTooltipElement(event.relatedTarget)
      if (nextElement === activeTarget) {
        return
      }

      hideTooltip()
    }

    document.addEventListener('mouseover', handlePointerOver)
    document.addEventListener('mousemove', handlePointerMove)
    document.addEventListener('mouseout', handlePointerOut)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    window.addEventListener('scroll', hideTooltip, true)

    return () => {
      clearShowTimer()
      document.removeEventListener('mouseover', handlePointerOver)
      document.removeEventListener('mousemove', handlePointerMove)
      document.removeEventListener('mouseout', handlePointerOut)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      window.removeEventListener('scroll', hideTooltip, true)
      restoreNativeTitle(activeTarget)
    }
  }, [])

  return (
    <div
      role="tooltip"
      className={`app-tooltip ${isVisible ? 'app-tooltip--visible' : ''}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      aria-hidden={!isVisible}
    >
      {content}
    </div>
  )
}

export default GlobalTooltip