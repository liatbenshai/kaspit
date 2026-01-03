import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to login page
  // Authentication check will happen on dashboard
  redirect('/login')
}
