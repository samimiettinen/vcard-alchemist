import { MixMatchApp } from '@/components/mixmatch/MixMatchApp'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'

const Index = () => {
  const { signOut, user } = useAuth()

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      toast.error('Uloskirjautuminen epäonnistui')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Mix&Match Contact Engine</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Kirjaudu ulos
          </Button>
        </div>
      </header>
      <main className="h-[calc(100vh-49px)]">
        <MixMatchApp />
      </main>
    </div>
  )
}

export default Index
