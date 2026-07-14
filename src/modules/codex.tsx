import { EDUCATION_DATA } from '../data/education';

export function Codex() {
  return (
    <div class="pane">
      <div class="sec-lbl">The Codex: Education Hub</div>
      <p class="hint">A highly researched, authoritative encyclopedia on specialty coffee, chemistry, and hardware.</p>
      
      <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
        {EDUCATION_DATA.map(sec => (
          <div class="card" style="background: var(--bg2);">
            <h2 style="margin-top: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--text);">
              <span>{sec.icon}</span> {sec.title}
            </h2>
            <div 
              class="markdown-body" 
              style="font-size: 0.95rem; line-height: 1.6; color: var(--faint);"
              dangerouslySetInnerHTML={{
                __html: sec.content
                  .replace(/### (.*?)\n/g, '<h3 style="color: var(--text); margin-top: 1.5rem; margin-bottom: 0.5rem;">$1</h3>')
                  .replace(/\*\*([^*]+)\*\*/g, '<b style="color: var(--pass);">$1</b>')
                  .replace(/\*([^*]+)\*/g, '<i style="color: var(--tan);">$1</i>')
                  .replace(/- (.*?)\n/g, '<li style="margin-bottom: 0.3rem;">$1</li>')
                  .replace(/<\/li>\n<li/g, '</li><li')
                  .replace(/(<li.*<\/li>)/g, '<ul style="padding-left: 1.2rem; margin-bottom: 1rem;">$1</ul>')
                  .replace(/\n\n/g, '<br/><br/>')
              }} 
            />
          </div>
        ))}
      </div>
    </div>
  );
}
