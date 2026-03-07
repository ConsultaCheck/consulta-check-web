"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/api";

const registerSchema = z
  .object({
    email: z.string().email("Ingrese un correo válido"),
    name: z.string().optional(),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`${getApiUrl()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          name: data.name || undefined,
          password: data.password,
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage((body as { message?: string }).message ?? "Error al crear la cuenta");
        return;
      }

      router.push("/?registered=1");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Error de conexión");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 md:px-0">
      <div className="grid w-full max-w-4xl gap-8 rounded-2xl bg-card/80 p-6 shadow-md md:grid-cols-2 md:p-10">
        <div className="hidden flex-col justify-center border-r border-border pr-6 md:flex">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            Crear cuenta en ConsultaCheck
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Regístrese para usar el sistema de conciliación médica y comparar
            pacientes atendidos con las liquidaciones mensuales.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Ya tiene cuenta?{" "}
            <Link href="/" className="font-medium text-primary underline underline-offset-4">
              Iniciar sesión
            </Link>
          </p>
        </div>

        <Card className="border-none shadow-none md:shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">Registro</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {errorMessage && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@consultacheck.cl"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nombre (opcional)</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Su nombre"
                  {...register("name")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repita la contraseña"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
              </Button>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                ¿Ya tiene cuenta?{" "}
                <Link href="/" className="font-medium text-primary underline underline-offset-4">
                  Iniciar sesión
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
