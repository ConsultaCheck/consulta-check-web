"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { getApiUrl, setStoredToken } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email("Ingrese un correo válido"),
  password: z.string().min(1, "Ingrese su contraseña"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`${getApiUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage((body as { message?: string }).message ?? "Error al iniciar sesión");
        return;
      }

      const { token } = body as { token: string };
      setStoredToken(token);
      router.push("/dashboard");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Error de conexión");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 md:px-0">
      <div className="grid w-full max-w-4xl gap-8 rounded-2xl bg-card/80 p-6 shadow-md md:grid-cols-2 md:p-10">
        <div className="hidden flex-col justify-center border-r border-border pr-6 md:flex">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            Bienvenido a ConsultaCheck
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sistema de conciliación médica para comparar pacientes atendidos
            con las liquidaciones mensuales de las clínicas.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Inicie sesión para acceder al panel, registrar asistencias,
            cargar liquidaciones y revisar el estado de pago de sus pacientes.
          </p>
        </div>

        <Card className="border-none shadow-none md:shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">
              Iniciar sesión
            </CardTitle>
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
                  <p className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Ingrese su contraseña"
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="mt-2 w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

