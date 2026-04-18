const Home = () => {
  return (
    <div className="space-y-6 p-8">
      <div>
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="list-none p-0 inline-flex items-center gap-2">
            <li className="font-semibold text-slate-900">Home</li>
          </ol>
        </nav>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Welcome to Aneka Kue</h1>
        <p className="text-lg text-slate-600">Your favorite place for delicious cakes and pastries</p>
      </div>
      <section>
        <h2 className="text-3xl font-semibold mb-6">Our Specialties</h2>
        <div className="flex flex-wrap justify-center gap-6">
          <div className="bg-slate-100 rounded-lg p-6 w-64 shadow-md">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Chocolate Cake</h3>
            <p className="text-slate-600">Rich and moist chocolate cake with layers of frosting.</p>
          </div>
          <div className="bg-slate-100 rounded-lg p-6 w-64 shadow-md">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Strawberry Tart</h3>
            <p className="text-slate-600">Fresh strawberries on a buttery tart shell.</p>
          </div>
          <div className="bg-slate-100 rounded-lg p-6 w-64 shadow-md">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Croissants</h3>
            <p className="text-slate-600">Flaky and buttery croissants baked fresh daily.</p>
          </div>
        </div>
      </section>
    </div>
  )
};

export default Home;