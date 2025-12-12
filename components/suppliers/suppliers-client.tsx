"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Plus, Search, Truck, Phone, Mail, MapPin, MoreHorizontal, Pencil, Trash, ShoppingCart } from "lucide-react"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddSupplierDialog } from "./add-supplier-dialog"
import { SupplierOrdersList } from "./supplier-orders-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

interface Supplier {
    id: string
    name: string
    contact_name: string | null
    phone: string | null
    email: string | null
    address: string | null
    created_at: string
}

export function SuppliersClient() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

    const fetchSuppliers = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .order('name', { ascending: true })
        
        if (error) {
            console.error("Error fetching suppliers:", error)
            toast.error("No se pudieron cargar los proveedores")
        } else {
            setSuppliers(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchSuppliers()
    }, [])

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este proveedor?")) return

        const { error } = await supabase.from('suppliers').delete().eq('id', id)
        if (error) {
             toast.error("Error al eliminar")
        } else {
             toast.success("Proveedor eliminado")
             fetchSuppliers()
        }
    }

    const filteredSuppliers = suppliers.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Proveedores</h1>
                    <p className="text-muted-foreground">Gestiona tus proveedores y contactos.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/suppliers/new-order">
                        <Button variant="outline">
                            <ShoppingCart className="mr-2 h-4 w-4" /> Nuevo Pedido
                        </Button>
                    </Link>
                    <Button onClick={() => { setSelectedSupplier(null); setIsAddOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Proveedor
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="list" className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4">
                    <TabsList>
                        <TabsTrigger value="list">Listado de Proveedores</TabsTrigger>
                        <TabsTrigger value="orders">Historial de Pedidos</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="list" className="flex-1 flex flex-col min-h-0 mt-0">
                    <Card className="flex-1 flex flex-col min-h-0">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por nombre o contacto..."
                                        className="pl-8"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto">
                            {loading ? (
                                <div className="flex items-center justify-center h-40">Cargando...</div>
                            ) : filteredSuppliers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-60 text-muted-foreground">
                                    <Truck className="h-12 w-12 mb-4 opacity-20" />
                                    <p>No se encontraron proveedores</p>
                                </div>
                            ) : (
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nombre</TableHead>
                                                <TableHead>Contacto</TableHead>
                                                <TableHead>Teléfono</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead className="text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredSuppliers.map((supplier) => (
                                                <TableRow key={supplier.id}>
                                                    <TableCell className="font-medium">{supplier.name}</TableCell>
                                                    <TableCell>{supplier.contact_name || "-"}</TableCell>
                                                    <TableCell>
                                                        {supplier.phone ? (
                                                            <div className="flex items-center gap-1">
                                                                <Phone className="h-3 w-3 text-muted-foreground" />
                                                                {supplier.phone}
                                                            </div>
                                                        ) : "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {supplier.email ? (
                                                            <div className="flex items-center gap-1">
                                                                <Mail className="h-3 w-3 text-muted-foreground" />
                                                                {supplier.email}
                                                            </div>
                                                        ) : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <span className="sr-only">Open menu</span>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                                <DropdownMenuItem onClick={() => { setSelectedSupplier(supplier); setIsAddOpen(true); }}>
                                                                    <Pencil className="mr-2 h-4 w-4" /> Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleDelete(supplier.id)} className="text-destructive focus:text-destructive">
                                                                    <Trash className="mr-2 h-4 w-4" /> Eliminar
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="orders" className="flex-1 mt-0">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Historial de Compras</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SupplierOrdersList />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AddSupplierDialog 
                open={isAddOpen} 
                onOpenChange={setIsAddOpen} 
                onSuccess={fetchSuppliers}
                supplierToEdit={selectedSupplier}
            />
        </div>
    )
}
