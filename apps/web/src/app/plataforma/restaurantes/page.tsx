"use client";

import { usePageTitle } from "@/lib/use-page-title";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FormError, errorMessage } from "@/components/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";

type Row = { id: string; name: string; slug: string; is_active: boolean };
type Page = { data: Row[]; meta: { page: number; per_page: number; total: number } };

const PER_PAGE = 20;

export default function RestaurantsPage() {
  usePageTitle("Restaurantes");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
    if (search.trim()) query.set("search", search.trim());
    api<Page>(`/platform/restaurants?${query}`)
      .then((data) => {
        setResult(data);
        setError(null);
      })
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [page, search]);

  const lastPage = result ? Math.max(1, Math.ceil(result.meta.total / PER_PAGE)) : 1;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Restaurantes</h1>
        <Link href="/plataforma/restaurantes/novo" className="text-sm underline">
          Novo restaurante
        </Link>
      </div>
      <Input
        type="search"
        placeholder="Buscar por nome ou slug"
        aria-label="Buscar restaurantes"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      <FormError message={error} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(result?.data ?? []).map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/plataforma/restaurantes/${row.id}`} className="underline">
                  {row.name}
                </Link>
              </TableCell>
              <TableCell>
                <code>{row.slug}</code>
              </TableCell>
              <TableCell>
                <Badge variant={row.is_active ? "secondary" : "outline"}>
                  {row.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {result && result.data.length === 0 ? (
        <p className="text-muted-foreground">Nenhum restaurante encontrado.</p>
      ) : null}
      <div className="flex items-center justify-between text-sm">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
        <span>
          Página {page} de {lastPage}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= lastPage}
          onClick={() => setPage(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
