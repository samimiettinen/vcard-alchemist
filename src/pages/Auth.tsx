import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { z } from 'zod'

const authSchema = z.object({
  email: z.string().email('Virheellinen sähköpostiosoite'),
  password: z.string().min(6, 'Salasanan tulee olla vähintään 6 merkkiä')
})

export default function Auth() {
  const navigate = useNavigate()
  const { signIn, signUp, isAuthenticated, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, loading, navigate])

  const handleSubmit = async (mode: 'login' | 'signup') => {
    // Validate input
    const result = authSchema.safeParse({ email, password })
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors
      if (errors.email) toast.error(errors.email[0])
      else if (errors.password) toast.error(errors.password[0])
      return
    }

    setIsSubmitting(true)
    
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Virheellinen sähköposti tai salasana')
          } else {
            toast.error(error.message)
          }
          return
        }
        toast.success('Kirjautuminen onnistui!')
      } else {
        const { error } = await signUp(email, password)
        if (error) {
          if (error.message.includes('User already registered')) {
            toast.error('Tämä sähköposti on jo rekisteröity')
          } else {
            toast.error(error.message)
          }
          return
        }
        toast.success('Rekisteröityminen onnistui! Kirjaudutaan sisään...')
      }
      navigate('/')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Mix&Match Contact Engine</CardTitle>
          <CardDescription>Kirjaudu sisään tai luo uusi tili</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Kirjaudu</TabsTrigger>
              <TabsTrigger value="signup">Rekisteröidy</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Sähköposti</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nimi@esimerkki.fi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Salasana</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => handleSubmit('login')}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Kirjaudutaan...' : 'Kirjaudu sisään'}
              </Button>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Sähköposti</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nimi@esimerkki.fi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Salasana</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Vähintään 6 merkkiä"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => handleSubmit('signup')}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Rekisteröidään...' : 'Luo tili'}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
