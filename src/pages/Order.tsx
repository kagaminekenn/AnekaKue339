const Order = () => {
  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="list-none p-0 inline-flex items-center gap-2">
            <li>Home</li>
            <li>/</li>
            <li className="font-semibold text-slate-900">Order</li>
          </ol>
        </nav>
        <h1 className="text-3xl font-bold text-slate-900">Order</h1>
      </div>
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
        Order page content will appear here.
      </div>
    </div>
  )
}

export default Order;
