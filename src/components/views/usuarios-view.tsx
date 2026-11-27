/**
 * EstoquePro — Gerenciamento de usuários (papel ADMIN)
 * Criação, edição, ativação/desativação e exclusão segura.
 */
import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EstadoVazio, PageHeader } from '@/components/shared'
import { api } from '@/lib/api'
import { data } from '@/lib/format'
import { toast } from 'sonner'
import type { UsuarioSessao } from '@/components/app-shell'

interface Usuario {
  id: number
  nome: string
  email: string
  papel: 'ADMIN' | 'OPERADOR'
  ativo: boolean
  criadoEm: string
}

export function UsuariosView({ usuarioAtual }: { usuarioAtual: UsuarioSessao }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)

  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', papel: 'OPERADOR', ativo: true })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState<Usuario | null>(null)
  const [processando, setProcessando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setUsuarios(await api.get<Usuario[]>('/api/usuarios'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar usuários.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const abrirNovo = () => {
    setEditando(null)
    setForm({ nome: '', email: '', senha: '', papel: 'OPERADOR', ativo: true })
    setErros({})
    setFormAberto(true)
  }

  const abrirEdicao = (u: Usuario) => {
    setEditando(u)
    setForm({ nome: u.nome, email: u.email, senha: '', papel: u.papel, ativo: u.ativo })
    setErros({})
    setFormAberto(true)
  }

  const salvar = async () => {
    const errosLocais: Record<string, string> = {}
    if (form.nome.trim().length < 2) errosLocais.nome = 'Informe o nome completo (mín. 2 caracteres).'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errosLocais.email = 'Informe um e-mail válido.'
    if (!editando || form.senha) {
      if (form.senha.length < 8) errosLocais.senha = 'Senha deve ter ao menos 8 caracteres.'
      else if (!/[A-Za-z]/.test(form.senha) || !/[0-9]/.test(form.senha))
        errosLocais.senha = 'Senha deve conter letras e números.'
    }
    setErros(errosLocais)
    if (Object.keys(errosLocais).length > 0) return

    setSalvando(true)
    try {
      if (editando) {
        const corpo: Record<string, unknown> = {
          nome: form.nome.trim(),
          papel: form.papel,
          ativo: form.ativo,
        }
        if (form.senha) corpo.senha = form.senha
        await api.patch(`/api/usuarios/${editando.id}`, corpo)
        toast.success('Usuário atualizado com sucesso.')
      } else {
        await api.post('/api/usuarios', {
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          senha: form.senha,
          papel: form.papel,
        })
        toast.success('Usuário cadastrado com sucesso.')
      }
      setFormAberto(false)
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar usuário.')
    } finally {
      setSalvando(false)
    }
  }

  const confirmarExclusao = async () => {
    if (!excluindo) return
    setProcessando(true)
    try {
      await api.del(`/api/usuarios/${excluindo.id}`)
      toast.success('Usuário excluído com sucesso.')
      setExcluindo(null)
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir usuário.')
      setExcluindo(null)
    } finally {
      setProcessando(false)
    }
  }

  const alternarAtivo = async (u: Usuario) => {
    try {
      await api.patch(`/api/usuarios/${u.id}`, { ativo: !u.ativo })
      toast.success(u.ativo ? 'Usuário desativado — acesso bloqueado no servidor.' : 'Usuário ativado.')
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao atualizar usuário.')
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Usuários e acessos"
        descricao="Administradores têm acesso total; operadores consultam e movimentam o estoque. As permissões são aplicadas no servidor."
        acoes={
          <Button onClick={abrirNovo} className="gap-2">
            <Plus className="h-4 w-4" /> Novo usuário
          </Button>
        }
      />

      <Card className="shadow-sm py-0">
        <CardContent className="p-0">
          {carregando ? (
            <EstadoVazio mensagem="Carregando usuários…" />
          ) : (
            <div className="overflow-x-auto scroll-fino">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead>Usuário</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="hidden sm:table-cell">Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.id} className={!u.ativo ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                            {u.nome
                              .split(' ')
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 flex items-center gap-2">
                              {u.nome}
                              {u.id === usuarioAtual.id && (
                                <Badge variant="outline" className="text-[10px]">você</Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.papel === 'ADMIN' ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
                            <ShieldCheck className="h-3 w-3" /> Administrador
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <UserRound className="h-3 w-3" /> Operador
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={u.ativo}
                          onCheckedChange={() => alternarAtivo(u)}
                          disabled={u.id === usuarioAtual.id}
                          aria-label={`Ativar/desativar ${u.nome}`}
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{data(u.criadoEm)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500"
                            title="Editar"
                            onClick={() => abrirEdicao(u)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${
                              u.id === usuarioAtual.id ? 'text-slate-300 cursor-not-allowed' : 'text-red-600'
                            }`}
                            title={u.id === usuarioAtual.id ? 'Você não pode excluir seu próprio usuário' : 'Excluir'}
                            onClick={() =>
                              u.id === usuarioAtual.id
                                ? toast.error('Você não pode excluir seu próprio usuário.')
                                : setExcluindo(u)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* formulário */}
      <Dialog open={formAberto} onOpenChange={(aberto) => !aberto && setFormAberto(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
            <DialogDescription>
              Senhas são armazenadas com hash bcrypt — nunca em texto puro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-nome">Nome *</Label>
              <Input
                id="u-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Maria Santos"
              />
              {erros.nome && <p className="text-xs text-red-600">{erros.nome}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">E-mail *</Label>
              <Input
                id="u-email"
                type="email"
                value={form.email}
                disabled={!!editando}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="maria@empresa.com"
              />
              {erros.email && <p className="text-xs text-red-600">{erros.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-senha">{editando ? 'Nova senha (opcional)' : 'Senha *'}</Label>
              <Input
                id="u-senha"
                type="password"
                value={form.senha}
                onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                placeholder={editando ? 'Deixe em branco para manter' : 'Mín. 8 caracteres com letras e números'}
              />
              {erros.senha && <p className="text-xs text-red-600">{erros.senha}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Papel *</Label>
                <Select value={form.papel} onValueChange={(v) => setForm((f) => ({ ...f, papel: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                    <SelectItem value="OPERADOR">Operador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editando && (
                <div className="space-y-1.5">
                  <Label>Situação</Label>
                  <div className="flex items-center gap-2 h-9">
                    <Switch
                      checked={form.ativo}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                      aria-label="Usuário ativo"
                    />
                    <span className="text-sm text-muted-foreground">{form.ativo ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo && (
                <>
                  Você está excluindo <strong>{excluindo.nome}</strong> ({excluindo.email}). Se o usuário tiver
                  movimentações registradas, a exclusão será bloqueada para preservar a auditoria — nesse caso
                  prefira <strong>desativar</strong> a conta.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmarExclusao()
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={processando}
            >
              {processando ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
