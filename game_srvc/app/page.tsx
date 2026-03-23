import { redirect } from 'next/navigation'

interface Props {
  searchParams: { room?: string; slot?: string }
}

export default function HomePage({ searchParams }: Props) {
  const params = new URLSearchParams()
  if (searchParams.room) params.set('room', searchParams.room)
  if (searchParams.slot) params.set('slot', searchParams.slot)
  const query = params.toString()
  redirect(`/games/space_supremacy/index.html${query ? `?${query}` : ''}`)
}