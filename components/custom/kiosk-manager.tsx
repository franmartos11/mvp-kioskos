"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import { createEmployee } from "@/app/actions/employees"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Plus, Store, Trash, UserPlus } from "lucide-react"

interface Kiosk {
  id: string
  name: string
  owner_id: string
}

interface Member {
  id: string
  user_id: string
  role: 'owner' | 'seller'
  profile: {
    email: string
    full_name: string | null
  }
}

export function KioskManager() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [loading, setLoading] = useState(true)
  const [newKioskName, setNewKioskName] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedKiosk, setSelectedKiosk] = useState<Kiosk | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false)
  
  // Registration Form State
  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [newMemberPassword, setNewMemberPassword] = useState("")
  const [newMemberName, setNewMemberName] = useState("")
  const [isRegistering, setIsRegistering] = useState(false)

  useEffect(() => {
    fetchKiosks()
  }, [])

  useEffect(() => {
    if (selectedKiosk) {
      fetchMembers(selectedKiosk.id)
    }
  }, [selectedKiosk])

  const fetchKiosks = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch kiosks where user is a member
      const { data, error } = await supabase
        .from('kiosk_members')
        .select(`
          kiosk_id,
          kiosks (
            id,
            name,
            owner_id
          ),
          role
        `)
        .eq('user_id', user.id)

      if (error) throw error

      // Flatten the structure
      const userKiosks = data.map((item: any) => item.kiosks)
      setKiosks(userKiosks)
      
      // Auto-select first kiosk if none selected
      if (!selectedKiosk && userKiosks.length > 0) {
        setSelectedKiosk(userKiosks[0])
      }
    } catch (error) {
      console.error("Error fetching kiosks:", error)
      toast.error("Error al cargar los kioscos")
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async (kioskId: string) => {
    try {
      const { data, error } = await supabase
        .from('kiosk_members')
        .select(`
          id,
          user_id,
          role
        `)
        .eq('kiosk_id', kioskId)

      if (error) throw error

      const memberUserIds = data.map(m => m.user_id)
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', memberUserIds)
      
      if (profilesError) { 
        console.error("Error fetching profiles", profilesError)
      }

      const membersWithProfiles = data.map(member => {
        const profile = profiles?.find(p => p.id === member.user_id) || { email: 'Desconocido', full_name: 'Desconocido' }
        return {
            ...member,
            profile
        }
      })

      setMembers(membersWithProfiles as Member[])
    } catch (error) {
      console.error("Error fetching members:", error)
      toast.error("Error al cargar empleados")
    }
  }

  const handleCreateKiosk = async () => {
    if (!newKioskName.trim()) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Create Kiosk
      const { data: kiosk, error: kioskError } = await supabase
        .from('kiosks')
        .insert({ name: newKioskName, owner_id: user.id })
        .select()
        .single()

      if (kioskError) throw kioskError

      // 2. Add creator as owner member
      const { error: memberError } = await supabase
        .from('kiosk_members')
        .insert({
            user_id: user.id,
            kiosk_id: kiosk.id,
            role: 'owner'
        })
      
      if (memberError) throw memberError

      toast.success("Kiosco creado exitosamente")
      setNewKioskName("")
      setIsCreateDialogOpen(false)
      fetchKiosks()
    } catch (error) {
      console.error("Error creating kiosk:", error)
      toast.error("Error al crear el kiosco")
    }
  }

  const handleRegisterEmployee = async () => {
      if (!selectedKiosk || !newMemberEmail.trim() || !newMemberPassword.trim()) {
          toast.error("Complete todos los campos")
          return
      }

      try {
          setIsRegistering(true)
          const formData = new FormData()
          formData.append("email", newMemberEmail)
          formData.append("password", newMemberPassword)
          formData.append("fullName", newMemberName)
          formData.append("kioskId", selectedKiosk.id)

          const result = await createEmployee(formData)

          if (result.error) {
              toast.error(result.error)
              return
          }

          toast.success("Empleado registrado y asignado exitosamente")
          setNewMemberEmail("")
          setNewMemberPassword("")
          setNewMemberName("")
          setIsAddMemberDialogOpen(false)
          fetchMembers(selectedKiosk.id)

      } catch (error) {
          console.error("Error registering employee:", error)
          toast.error("Error al registrar empleado")
      } finally {
          setIsRegistering(false)
      }
  }

  const handleRemoveMember = async (memberId: string) => {
      if (!confirm("¿Está seguro de eliminar a este empleado del kiosco?")) return

      try {
          const { error } = await supabase
            .from('kiosk_members')
            .delete()
            .eq('id', memberId)
          
          if (error) throw error

          toast.success("Empleado eliminado del kiosco")
          if (selectedKiosk) fetchMembers(selectedKiosk.id)
      } catch (error) {
          console.error("Error removing member:", error)
          toast.error("Error al eliminar empleado")
      }
  }

  if (loading && kiosks.length === 0) {
      return <div>Cargando configuración...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Mis Kioscos</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo Kiosco
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Kiosco</DialogTitle>
              <DialogDescription>
                Ingresa el nombre de tu nuevo punto de venta.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="name">Nombre del Kiosco</Label>
              <Input 
                id="name" 
                value={newKioskName} 
                onChange={(e) => setNewKioskName(e.target.value)}
                placeholder="Ej. Kiosco Central" 
              />
            </div>
            <DialogFooter>
              <Button onClick={handleCreateKiosk}>Crear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kiosks.map((kiosk) => (
          <Card 
            key={kiosk.id} 
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedKiosk?.id === kiosk.id ? 'border-primary' : ''}`}
            onClick={() => setSelectedKiosk(kiosk)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {kiosk.name}
              </CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">ID: {kiosk.id.substring(0, 8)}...</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedKiosk && (
        <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Equipo de {selectedKiosk.name}</CardTitle>
                    <CardDescription>Gestiona los empleados para este kiosco.</CardDescription>
                </div>
                <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <UserPlus className="mr-2 h-4 w-4" /> Registrar Empleado
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Registrar Nuevo Empleado</DialogTitle>
                            <DialogDescription>
                                Crea una cuenta para un nuevo vendedor y asígnalo a este kiosco.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullname">Nombre Completo</Label>
                                <Input 
                                    id="fullname" 
                                    value={newMemberName} 
                                    onChange={(e) => setNewMemberName(e.target.value)}
                                    placeholder="Juan Pérez" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input 
                                    id="email" 
                                    type="email"
                                    value={newMemberEmail} 
                                    onChange={(e) => setNewMemberEmail(e.target.value)}
                                    placeholder="empleado@kioskapp.com" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <Input 
                                    id="password" 
                                    type="password"
                                    value={newMemberPassword} 
                                    onChange={(e) => setNewMemberPassword(e.target.value)}
                                    placeholder="••••••••" 
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleRegisterEmployee} disabled={isRegistering}>
                                {isRegistering ? "Registrando..." : "Registrar y Asignar"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {members.map((member) => (
                            <TableRow key={member.id}>
                                <TableCell>{member.profile.full_name || 'Sin nombre'}</TableCell>
                                <TableCell>{member.profile.email}</TableCell>
                                <TableCell>
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                        member.role === 'owner' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                        {member.role === 'owner' ? 'Dueño' : 'Vendedor'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    {member.role !== 'owner' && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleRemoveMember(member.id)}
                                        >
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {members.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                    No hay empleados asignados a este kiosco.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      )}
    </div>
  )
}
