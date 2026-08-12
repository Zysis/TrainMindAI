/** Numeri che si animano da 0 al valore in data-to quando entrano in vista. */
export function initCounters() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return
      io.unobserve(e.target)
      const el = e.target
      const to = +el.dataset.to
      const t0 = performance.now()
      const dur = 1300
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1)
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }, { threshold: 0.5 })
  document.querySelectorAll('.cnt').forEach((n) => io.observe(n))
}
