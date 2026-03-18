"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Eye,
  EyeOff,
  Check,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LLM_PROVIDER_PRESETS,
  getProviderPreset,
  type ProviderType,
} from "@/lib/llm/provider-presets";

export interface LLMIntegrationFormData {
  id?: string;
  provider: ProviderType;
  displayName: string;
  baseUrl: string;
  username: string;
  password: string;
  apiKey: string;
  model: string;
  notes: string;
  isActive: boolean;
  isDefault: boolean;
}

interface LLMIntegrationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<LLMIntegrationFormData>;
  onSubmit: (data: LLMIntegrationFormData) => Promise<void>;
  mode: "add" | "edit";
}

export function LLMIntegrationForm({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  mode,
}: LLMIntegrationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(
    initialData?.provider || "zai"
  );
  const [customModel, setCustomModel] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LLMIntegrationFormData>({
    defaultValues: {
      provider: initialData?.provider || "zai",
      displayName: initialData?.displayName || "",
      baseUrl: initialData?.baseUrl || "",
      username: initialData?.username || "",
      password: "",
      apiKey: "",
      model: initialData?.model || "",
      notes: initialData?.notes || "",
      isActive: initialData?.isActive ?? true,
      isDefault: initialData?.isDefault ?? false,
    },
  });

  const watchedProvider = watch("provider");
  const watchedModel = watch("model");

  // Update form when provider changes
  useEffect(() => {
    const preset = getProviderPreset(watchedProvider);
    if (preset && mode === "add") {
      setValue("baseUrl", preset.baseUrl);
      if (preset.models.length > 0 && !watchedModel) {
        setValue("model", preset.models[0]);
      }
    }
    setSelectedProvider(watchedProvider as ProviderType);
  }, [watchedProvider, setValue, mode, watchedModel]);

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      reset({
        id: initialData?.id,
        provider: initialData?.provider || "zai",
        displayName: initialData?.displayName || "",
        baseUrl: initialData?.baseUrl || getProviderPreset(initialData?.provider || "zai")?.baseUrl || "",
        username: initialData?.username || "",
        password: "",
        apiKey: "",
        model: initialData?.model || "",
        notes: initialData?.notes || "",
        isActive: initialData?.isActive ?? true,
        isDefault: initialData?.isDefault ?? false,
      });
      setSelectedProvider((initialData?.provider || "zai") as ProviderType);
      setCustomModel("");
    }
  }, [open, initialData, reset]);

  const handleFormSubmit = async (data: LLMIntegrationFormData) => {
    setIsSubmitting(true);
    try {
      // If custom model is entered, use that instead
      if (customModel) {
        data.model = customModel;
      }
      await onSubmit(data);
      onOpenChange(false);
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error("Failed to save integration");
    } finally {
      setIsSubmitting(false);
    }
  };

  const preset = getProviderPreset(selectedProvider);
  const availableModels = preset?.models || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add New LLM Integration" : "Edit LLM Integration"}
          </DialogTitle>
          <DialogDescription>
            Configure your AI provider settings. All credentials are encrypted.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label htmlFor="provider">Provider *</Label>
            <Select
              value={watchedProvider}
              onValueChange={(value) => setValue("provider", value as ProviderType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LLM_PROVIDER_PRESETS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <span>{config.icon}</span>
                      <span>{config.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">
              Display Name *
            </Label>
            <Input
              id="displayName"
              placeholder="e.g., Production OpenAI"
              {...register("displayName", { required: "Display name is required" })}
            />
            {errors.displayName && (
              <p className="text-sm text-destructive">{errors.displayName.message}</p>
            )}
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>API endpoint URL. Auto-filled based on provider.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="baseUrl"
              placeholder="https://api.example.com/v1"
              {...register("baseUrl")}
            />
          </div>

          {/* Username (optional) */}
          <div className="space-y-2">
            <Label htmlFor="username">Username (optional)</Label>
            <Input
              id="username"
              placeholder="Username for authentication"
              {...register("username")}
            />
          </div>

          {/* Password (optional) */}
          <div className="space-y-2">
            <Label htmlFor="password">Password (optional)</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                {...register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* API Key */}
          {preset?.requiresApiKey && (
            <div className="space-y-2">
              <Label htmlFor="apiKey">
                API Key {mode === "add" && "*"}
              </Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  placeholder={mode === "edit" ? "Leave empty to keep existing" : "Enter API key"}
                  {...register("apiKey", {
                    required: mode === "add" ? "API key is required" : false,
                  })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.apiKey && (
                <p className="text-sm text-destructive">{errors.apiKey.message}</p>
              )}
            </div>
          )}

          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model">Model *</Label>
            {availableModels.length > 0 ? (
              <>
                <Select
                  value={watchedModel}
                  onValueChange={(value) => setValue("model", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">Custom model...</SelectItem>
                  </SelectContent>
                </Select>
                <AnimatePresence>
                  {watchedModel === "__custom__" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2"
                    >
                      <Input
                        placeholder="Enter custom model name"
                        value={customModel}
                        onChange={(e) => setCustomModel(e.target.value)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <Input
                id="model"
                placeholder="Enter model identifier"
                {...register("model", { required: "Model is required" })}
              />
            )}
            {errors.model && (
              <p className="text-sm text-destructive">{errors.model.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Description</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes about this integration..."
              className="resize-none"
              rows={3}
              {...register("notes")}
            />
          </div>

          {/* Toggles */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable this integration for use
                </p>
              </div>
              <Switch
                id="isActive"
                checked={watch("isActive")}
                onCheckedChange={(checked) => setValue("isActive", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isDefault">Set as Default</Label>
                <p className="text-sm text-muted-foreground">
                  Use as the default AI provider
                </p>
              </div>
              <Switch
                id="isDefault"
                checked={watch("isDefault")}
                onCheckedChange={(checked) => setValue("isDefault", checked)}
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "add" ? "Add Integration" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
