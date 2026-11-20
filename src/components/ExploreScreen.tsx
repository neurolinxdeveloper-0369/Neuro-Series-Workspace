import { Modal } from './Modal';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BedDouble, Clapperboard, Grid2X2, House, Layers, Moon, PersonStanding, Play, Plus, Sun, Thermometer, Zap } from 'lucide-react';
import { getAssetUrl } from '../utils/assets';
import './ExploreScreen.css';

const scenes = [
  { name: 'Good Night', description: 'Turn off lights, set AC, secure home', Icon: BedDouble, theme: 'night' },
  { name: 'Good Morning', description: 'Open curtains, lights on, ready to start', Icon: Sun, theme: 'morning' },
  { name: 'Movie Time', description: 'Dim lights, set perfect ambience', Icon: Clapperboard, theme: 'movie' },
];
const products = [
  { name: 'Neuro Touch Panel', description: 'Smart control for your space', position: null },
  { name: 'Smart Relay', description: 'Control lights, fans and more', position: '0%' },
  { name: 'Motion Sensor', description: 'Detect movement and trigger actions', position: '50%' },
  { name: 'Smart Plug', description: 'Make any device smart', position: '100%' },
];
const banners = [
  { title: 'Make Your Space Smarter', description: 'Automation, control and comfort – all in one place.' },
  { title: 'A Scene for Every Moment', description: 'Discover a calmer, more connected home.' },
  { title: 'Bring Your Home Together', description: 'Explore devices for every corner of your space.' },
];

export function ExploreScreen() {
  const [slide, setSlide] = useState(0);
  const [category, setCategory] = useState('Scenes');
  const [motion, setMotion] = useState(true);
  const [preview, setPreview] = useState<{ title: string; description: string } | null>(null);
  const touch = useRef(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden && !preview) setSlide(value => (value + 1) % banners.length);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [preview]);
  const open = (title: string, description: string) => setPreview({ title, description });
  const sectionHeading = (title: string, description: string) => <div className="explore-section-heading">
    <h2>{title}</h2><button type="button" onClick={() => open(title, description)}>View All<ArrowRight size={15} /></button>
  </div>;

  return <div className="explore-design">
    <header className="explore-intro"><h1>Explore</h1><p>Discover scenes, automations, devices and more<br className="hidden sm:block" /> for your smart space.</p></header>

    <section className="explore-hero" aria-label="Smart home inspiration"
      onTouchStart={event => { touch.current = event.touches[0].clientX; }}
      onTouchEnd={event => { const distance = touch.current - event.changedTouches[0].clientX; if (Math.abs(distance) > 40) setSlide(value => (value + (distance > 0 ? 1 : 2)) % 3); }}>
      <div className="explore-hero-track" style={{ transform: 'translateX(-' + slide * 100 + '%)' }}>
        {banners.map((banner, index) => <div key={banner.title} className="explore-hero-panel" aria-hidden={index !== slide} inert={index !== slide}>
          <img src={getAssetUrl('explore/smart-home-hero.png')} alt="Blue sofa, floor lamp, houseplant and smart control panel in a sunlit living room" />
          <div className="explore-hero-copy"><span>SMART HOME</span><h2>{banner.title}</h2><p>{banner.description}</p>
            <button type="button" onClick={() => open(banner.title, 'Explore scenes, automation ideas and recommended devices below. Choose any card to preview it.')}>Get Started<ArrowRight size={16} /></button>
          </div>
        </div>)}
      </div>
    </section>
    <div className="explore-hero-dots" role="group" aria-label="Inspiration slides">{banners.map((item, index) => <button key={item.title} type="button" aria-label={`Show slide ${index + 1}`} aria-pressed={slide === index} onClick={() => setSlide(index)}><span /></button>)}</div>

    <div className="explore-categories" role="group" aria-label="Explore categories">{[
      { name: 'Scenes', description: 'One-tap control', Icon: House, id: 'explore-scenes' },
      { name: 'Automations', description: 'Set it and forget', Icon: Zap, id: 'explore-automations' },
      { name: 'Devices', description: 'Add & discover', Icon: Layers, id: 'explore-products' },
      { name: 'More', description: 'Tips, guides & more', Icon: Grid2X2, id: '' },
    ].map(({ name, description, Icon, id }) => <button key={name} type="button" aria-pressed={category === name} onClick={() => {
      setCategory(name);
      if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      else open('Tips, guides & more', 'Explore scene ideas, discover useful devices, and find inspiration for a comfortable smart home.');
    }}><Icon aria-hidden="true" /><strong>{name}</strong><span>{description}</span></button>)}</div>

    <section id="explore-scenes">
      {sectionHeading('Featured Scenes', 'Good Night · Good Morning · Movie Time. Choose a featured scene to preview its atmosphere.')}
      <div className="explore-scenes">{scenes.map(({ name, description, Icon, theme }) => <article key={name} className={'explore-scene ' + theme}>
        <div className="explore-scene-art"><Icon aria-hidden="true" />{theme === 'morning' ? <Sun aria-hidden="true" /> : theme === 'night' ? <Moon aria-hidden="true" /> : <Clapperboard aria-hidden="true" />}</div>
        <div className="explore-scene-copy"><h3>{name}</h3><p>{description}</p></div>
        <button type="button" aria-label={`Preview ${name}`} onClick={() => open(name, description)}><Play size={14} fill="currentColor" /></button>
      </article>)}</div>
    </section>

    <section id="explore-automations">
      {sectionHeading('Automation Ideas', 'Motion Based Lighting: turn on lights when movement is detected. Temperature Control: keep your room comfortable automatically.')}
      <div className="explore-automations">
        <article><span className="explore-automation-icon"><PersonStanding /></span><div><h3>Motion Based Lighting</h3><p>Turn on lights when movement is detected</p></div>
          <button type="button" role="switch" aria-label="Preview motion based lighting" aria-checked={motion} className="explore-switch" onClick={() => { setMotion(value => !value); open('Motion Based Lighting', 'Preview: lights turn on when movement is detected.'); }}><span /></button>
        </article>
        <article><span className="explore-automation-icon"><Thermometer /></span><div><h3>Temperature Control</h3><p>Keep your room comfortable automatically</p></div>
          <button type="button" aria-label="Preview temperature control" className="explore-plus" onClick={() => open('Temperature Control', 'Preview: keep your room comfortable automatically.')}><Plus size={19} /></button>
        </article>
      </div>
    </section>

    <section id="explore-products">
      {sectionHeading('Recommended Devices', 'Neuro Touch Panel · Smart Relay · Motion Sensor · Smart Plug. Choose Add Device to preview a product.')}
      <div className="explore-products">{products.map(product => <article key={product.name}>
        {product.position === null ? <img className="explore-product-photo" src={getAssetUrl('8S.png')} alt="Neuro Touch panel" /> :
          <div className="explore-product-photo explore-product-sprite" role="img" aria-label={product.name} style={{ backgroundImage: `url("${getAssetUrl('explore/device-products.png')}")`, backgroundPosition: `${product.position} center` }} />}
        <h3>{product.name}</h3><p>{product.description}</p>
        <button type="button" onClick={() => open(product.name, product.description)} aria-label={`Preview adding ${product.name}`}>Add Device<Plus size={13} /></button>
      </article>)}</div>
    </section>

    {preview && <Modal title={preview.title} onClose={() => setPreview(null)}>
      <span className="text-xs font-bold tracking-widest text-sky-600">PREVIEW</span>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{preview.description}</p>
      <button type="button" onClick={() => setPreview(null)} className="mt-5 min-h-11 rounded-full bg-sky-500 px-6 font-bold text-white">Done</button>
    </Modal>}
  </div>;
}
