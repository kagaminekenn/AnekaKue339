const Order = () => {
  return (
    <div className="page-enter space-y-6">
      <div className="page-header">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="list-none p-0 inline-flex items-center gap-2">
            <li>Home</li>
            <li>/</li>
            <li className="font-semibold text-slate-900">Pricing</li>
            <li>/</li>
            <li className="font-semibold uppercase tracking-[0.08em] text-cyan-800">Order</li>
          </ol>
        </nav>
        <h1 className="page-title">Order Pricing</h1>
        <p className="page-subtitle">Atur harga order secara cepat dengan pengalaman visual yang lebih fokus.</p>
      </div>
      <div className="glass-panel rounded-3xl border border-cyan-100 p-10 text-center text-slate-600">
        Order page content will appear here.
      </div>
    </div>
  )
}

export default Order;
