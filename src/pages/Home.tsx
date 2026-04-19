const Home = () => {
  return (
    <div className="page-enter space-y-6">
      <div className="page-header">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="list-none p-0 inline-flex items-center gap-2">
            <li className="font-semibold uppercase tracking-[0.08em] text-cyan-800">Home</li>
          </ol>
        </nav>
        <h1 className="page-title">Welcome to Aneka Kue 339</h1>
        <p className="page-subtitle">Kelola produk, harga, dan operasi harian dalam satu dashboard yang ringkas.</p>
      </div>
      <section>
        <h2 className="mb-5 text-2xl font-semibold text-slate-900">Highlight Hari Ini</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          <div className="glass-panel rounded-2xl border border-cyan-100 p-6">
            <h3 className="mb-2 font-heading text-xl font-semibold text-slate-900">Chocolate Cake</h3>
            <p className="text-slate-600">Produk premium dengan margin tinggi dan repeat-order stabil.</p>
          </div>
          <div className="glass-panel rounded-2xl border border-cyan-100 p-6">
            <h3 className="mb-2 font-heading text-xl font-semibold text-slate-900">Strawberry Tart</h3>
            <p className="text-slate-600">Pilihan seasonal dengan performa baik di outlet office.</p>
          </div>
          <div className="glass-panel rounded-2xl border border-cyan-100 p-6">
            <h3 className="mb-2 font-heading text-xl font-semibold text-slate-900">Croissants</h3>
            <p className="text-slate-600">Produk sarapan andalan, cepat habis dan rotasi harian tinggi.</p>
          </div>
        </div>
      </section>
    </div>
  )
};

export default Home;