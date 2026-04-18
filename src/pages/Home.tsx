const Home = () => {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="list-none p-0 inline-flex items-center gap-2">
            <li className="font-semibold text-slate-900">Home</li>
          </ol>
        </nav>
        <h1 className="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">Welcome to Aneka Kue</h1>
        <p className="text-base text-slate-600 sm:text-lg">Your favorite place for delicious cakes and pastries</p>
      </div>
      <section>
        <h2 className="mb-6 text-2xl font-semibold sm:text-3xl">Our Specialties</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          <div className="rounded-lg bg-slate-100 p-6 shadow-md">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Chocolate Cake</h3>
            <p className="text-slate-600">Rich and moist chocolate cake with layers of frosting.</p>
          </div>
          <div className="rounded-lg bg-slate-100 p-6 shadow-md">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Strawberry Tart</h3>
            <p className="text-slate-600">Fresh strawberries on a buttery tart shell.</p>
          </div>
          <div className="rounded-lg bg-slate-100 p-6 shadow-md">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Croissants</h3>
            <p className="text-slate-600">Flaky and buttery croissants baked fresh daily.</p>
          </div>
        </div>
      </section>
    </div>
  )
};

export default Home;