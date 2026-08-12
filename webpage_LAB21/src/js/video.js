/**
 * Riquadro video della sezione Metodo.
 * Al click sostituisce l'immagine poster con il video indicato in data-video.
 * Se il file non esiste, il poster resta al suo posto (nessun errore visibile).
 */
export function initVideo() {
  // Con "riduci animazioni" attivo il video della vetrina resta sul poster.
  if (typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.sc-media video, .vidbox video').forEach((v) => {
      v.removeAttribute('autoplay'); v.pause()
    })
  }

  document.querySelectorAll('.vidbox[data-video]').forEach((box) => {
    const btn = box.querySelector('.play button')
    if (!btn) return
    btn.addEventListener('click', () => {
      const src = box.dataset.video
      const poster = box.querySelector('img')
      const video = document.createElement('video')
      video.src = src
      video.controls = true
      video.autoplay = true
      video.playsInline = true
      video.onerror = () => { video.remove(); box.querySelector('.play')?.removeAttribute('hidden') }
      video.oncanplay = () => { poster?.remove() }
      box.querySelector('.play')?.setAttribute('hidden', '')
      box.prepend(video)
    })
  })
}
