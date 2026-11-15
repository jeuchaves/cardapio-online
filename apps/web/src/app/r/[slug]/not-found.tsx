export default function PublicMenuNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl font-semibold">Cardápio não encontrado</h1>
      <p className="text-sm text-muted-foreground">
        Confira o endereço ou o QR Code. Este cardápio não existe ou está indisponível.
      </p>
    </main>
  );
}
