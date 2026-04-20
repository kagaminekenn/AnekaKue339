import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole, LogIn, Mail } from 'lucide-react'
import logo from '../assets/logo.png'

interface LoginProps {
  onSubmit: (email: string, password: string) => Promise<string | null>
}

const Login = ({ onSubmit }: LoginProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsLoading(true)

    const error = await onSubmit(email.trim(), password)

    setIsLoading(false)
    if (error) {
      setErrorMessage(error)
      return
    }

    setPassword('')
  }

  return (
    <div className="page-enter flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="glass-panel relative w-full max-w-md overflow-hidden rounded-[1.5rem] border border-cyan-100/70 bg-white/90 p-6 sm:p-8">
        <div className="absolute -top-16 right-[-2.2rem] h-40 w-40 rounded-full bg-cyan-300/30 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-[-4rem] left-[-3rem] h-40 w-40 rounded-full bg-sky-200/45 blur-3xl" aria-hidden="true" />

        <div className="relative flex flex-col items-center text-center">
          <img
            src={logo}
            alt="Aneka Kue 339 logo"
            className="h-28 w-28 rounded-[1.75rem] border border-cyan-100 bg-white p-1.5 shadow-sm sm:h-32 sm:w-32"
          />
          <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-cyan-800">Aneka Kue 339</p>
        </div>

        <form className="relative mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <div className="relative mt-2">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="modern-input w-full py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400"
                placeholder="nama@perusahaan.com"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Password
            <div className="relative mt-2">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="modern-input w-full py-2.5 pl-10 pr-11 text-sm text-slate-800 placeholder:text-slate-400"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="modern-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {isLoading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login