<script setup>
defineProps({ compact: Boolean })
</script>

<template>
  <section class="hg-community" :class="{ 'hg-community-compact': compact }" aria-label="Comunidad HarmoniGrid">
    <h2>La comunidad crece contigo</h2>
    <p>Comparte este camino con otras personas que crean y aprenden música.</p>
    <div class="hg-community-links">
      <a href="https://www.instagram.com/harmonigrid/" target="_blank" rel="noopener noreferrer" aria-label="Seguir a HarmoniGrid en Instagram (abre otra pestaña)">Instagram <span aria-hidden="true">↗</span></a>
      <a href="https://whatsapp.com/channel/0029Vb8aWkh7DAX5MmBep40X" target="_blank" rel="noopener noreferrer" aria-label="Seguir el canal de HarmoniGrid en WhatsApp (abre otra pestaña)">Canal de WhatsApp <span aria-hidden="true">↗</span></a>
    </div>
    <small>Ideas, tips y novedades. A tu ritmo.</small>
  </section>
</template>

<style scoped>
.hg-community{margin-top:24px;padding:18px 10px 0;border-top:1px solid #dce5cf;text-align:center;color:#4e5c42}
h2{font-size:14px;font-weight:750;color:#263b13;margin:0 0 6px}p{font-size:12px;line-height:1.6;margin:0 auto;max-width:360px}
.hg-community-links{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 16px;margin:6px 0}
a{display:inline-flex;align-items:center;gap:6px;min-height:44px;font-size:13px;font-weight:700;color:#365600;text-decoration:underline;text-underline-offset:4px;border-radius:6px}a:hover{color:#172600}a:focus-visible{outline:3px solid #6a990e;outline-offset:3px}small{font-size:11px}
.hg-community-compact{margin-top:8px;padding:12px 0 0;text-align:left}.hg-community-compact h2{font-size:13px}.hg-community-compact p{margin:0}.hg-community-compact .hg-community-links{justify-content:flex-start;gap:4px 12px;margin:2px 0}
</style>
