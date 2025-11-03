import { zodResolver } from '@hookform/resolvers/zod'
import { CommandItem } from 'cmdk'
import { Check, ChevronsUpDown } from 'lucide-react'
import { observer } from 'mobx-react'
import React, { useCallback, useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/components/ui/command'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { cn, withExceptionCapturing } from '@/lib/utils'

import { ChatModelInfo, getAvailableModels } from '../agent/ChatModel'

import { ApiKeyVault } from './ApiKeyVault'
import { IChatWidgetModel } from './model/ChatbotWidgetModel'
import { Settings, SettingsFormSchema } from './model/SettingsFormModel'

export const SettingsForm = observer(function ({
  model,
}: {
  model: IChatWidgetModel
}) {
  const { settingsForm, apiKeyVault } = model
  const form = useForm<Settings>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: settingsForm.settings,
  })
  const onSubmit = withExceptionCapturing(
    form.handleSubmit((s: Settings) => {
      settingsForm.set(s)
      form.reset(s)
    }),
  )
  // watch all dynamic fields
  const provider = form.watch('provider')
  const baseUrl = form.watch(`providerSettings.${provider}.baseUrl`)
  const modelId = form.watch(`providerSettings.${provider}.model`)
  const useProviderSystemPrompt = form.watch('useProviderSystemPrompt')
  // api key state
  const [apiKeyExists, setApiKeyExists] = useState<boolean>(
    apiKeyVault.exists(provider),
  )
  // fetching model list
  const [providerModels, setProviderModels] = useState<
    Record<string, ChatModelInfo>
  >({})
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false)
  const getApiKey = useCallback(
    ({}: object) => {
      if (apiKeyExists ?? apiKeyVault.exists(provider))
        return apiKeyVault.get(provider)
      return Promise.resolve(undefined)
    },
    [provider, apiKeyVault, apiKeyExists],
  )
  const getModels = useCallback(() => {
    let isCancelled = false
    setProviderModels({})
    setIsFetchingModels(true)
    getAvailableModels({
      provider,
      baseUrl,
      getApiKey,
    })
      .then(models => {
        if (!isCancelled) setProviderModels(models)
      })
      .catch(error => {
        if (!isCancelled) console.error('Error fetching model list:', error)
      })
      .finally(() => {
        setIsFetchingModels(false)
        setApiKeyExists(apiKeyVault.exists(provider))
      })
    return () => {
      isCancelled = true
    }
  }, [provider, baseUrl, getApiKey, apiKeyVault])
  useEffect(getModels, [getModels])
  // model info state for combobox
  const [modelSearchValue, setModelSearchValue] = useState<string>('')
  const [activeModelInfo, setActiveModelInfo] = useState<ChatModelInfo | null>(
    null,
  )
  useEffect(() => {
    setActiveModelInfo(
      providerModels[modelId] ??
        providerModels[Object.keys(providerModels)[0]] ??
        null,
    )
  }, [modelId, providerModels])
  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <FieldGroup>
        <Controller
          name="provider"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldContent>
                <FieldLabel htmlFor={field.name}>Language Model API</FieldLabel>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </FieldContent>
              <Select
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                >
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent position="item-aligned">
                  {SettingsFormSchema.shape.provider.options.map(p => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          name={`providerSettings.${provider}.baseUrl`}
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                Alternate API Endpoint
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <ApiKeyVault
          model={model}
          provider={provider}
          apiKeyExists={apiKeyExists}
          setApiKeyExists={setApiKeyExists}
        />
        <Controller
          name={`providerSettings.${provider}.model`}
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldContent>
                <FieldLabel htmlFor={field.name}>Model ID</FieldLabel>
                <FieldDescription>
                  Model to use for agentic text generation.
                </FieldDescription>
              </FieldContent>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id={field.name}
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'justify-between',
                      !field.value && 'text-muted-foreground',
                    )}
                  >
                    {field.value || 'Select a model...'}
                    <ChevronsUpDown className="text-muted-foreground opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[560px] p-0">
                  <div className="grid grid-cols-2">
                    <Command
                      className="border-r"
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                          requestAnimationFrame(() => {
                            const el = document.querySelector(
                              '[cmdk-item][data-selected="true"]',
                            )
                            const value = el?.getAttribute('data-value')
                            if (value) setActiveModelInfo(providerModels[value])
                          })
                        }
                      }}
                    >
                      <CommandInput
                        placeholder="Search models..."
                        className="h-9"
                        value={modelSearchValue}
                        onValueChange={val => setModelSearchValue(val.trim())}
                      />
                      <CommandList>
                        <CommandEmpty>No models found.</CommandEmpty>
                        {!modelSearchValue ||
                        modelSearchValue in providerModels ? null : (
                          <CommandGroup>
                            <CommandItem
                              value={modelSearchValue}
                              data-value={modelSearchValue}
                              key={provider + '-input-' + modelSearchValue}
                              onSelect={() => {
                                form.setValue(
                                  `providerSettings.${provider}.model`,
                                  modelSearchValue,
                                )
                                setActiveModelInfo(
                                  providerModels[modelSearchValue] ?? null,
                                )
                              }}
                              onMouseEnter={() =>
                                setActiveModelInfo(
                                  providerModels[modelSearchValue] ?? null,
                                )
                              }
                              onFocus={() =>
                                setActiveModelInfo(
                                  providerModels[modelSearchValue] ?? null,
                                )
                              }
                              className="flex items-center gap-1"
                            >
                              <Check
                                className={cn(
                                  'h-4 w-4',
                                  modelSearchValue === field.value
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                              <span className="truncate">
                                {modelSearchValue}
                              </span>
                            </CommandItem>
                          </CommandGroup>
                        )}
                        <CommandGroup heading={provider}>
                          {Object.entries(providerModels).map(([id, info]) => (
                            <CommandItem
                              value={id}
                              data-value={id}
                              key={provider + '-' + id}
                              onSelect={() => {
                                form.setValue(
                                  `providerSettings.${provider}.model`,
                                  id,
                                )
                                setActiveModelInfo(info)
                              }}
                              onMouseEnter={() => setActiveModelInfo(info)}
                              onFocus={() => setActiveModelInfo(info)}
                              className="flex items-center gap-1"
                            >
                              <Check
                                className={cn(
                                  'h-4 w-4',
                                  id === field.value
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                              <span className="truncate">{id}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    <div
                      className="p-3 overflow-scroll bg-muted/30 text-xs leading-relaxed"
                      aria-live="polite"
                    >
                      {activeModelInfo ? (
                        <div className="space-y-2">
                          <div className="font-medium text-sm">
                            {activeModelInfo.id}
                          </div>
                          <div className="text-muted-foreground whitespace-pre-wrap">
                            {activeModelInfo.description ?? ''}
                          </div>
                        </div>
                      ) : Object.keys(providerModels).length ? (
                        <div className="text-muted-foreground">
                          Hover or navigate to a model to see details.
                        </div>
                      ) : isFetchingModels ? (
                        <div className="text-muted-foreground">
                          Fetching models...
                        </div>
                      ) : apiKeyExists ? (
                        <div className="text-muted-foreground">
                          No models fetched. Verify provider/API key.
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          No models fetched. You may need to Unlock the API Key
                          Vault (above).
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="useProviderSystemPrompt"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldContent>
                <FieldLabel htmlFor={field.name}>Prompt Mode</FieldLabel>
              </FieldContent>
              <Select
                name={field.name}
                value={String(field.value)}
                onValueChange={val => field.onChange(val === 'true')}
              >
                <SelectTrigger
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="item-aligned">
                  <SelectItem value={'false'}>Use default prompt</SelectItem>
                  <SelectItem value={'true'}>
                    Use provider-specific prompt
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          name={
            useProviderSystemPrompt
              ? `providerSettings.${provider}.systemPrompt`
              : 'defaultSystemPrompt'
          }
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Prompt</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name={`providerSettings.${provider}.temperature`}
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Temperature</FieldLabel>
              <FieldDescription>{field.value ?? 0}%</FieldDescription>
              <Slider
                value={[field.value ?? 0]}
                onValueChange={val => field.onChange(val[0])}
                max={100}
                step={1}
                className="flex-1 py-2"
                aria-label="Temperature"
              />
            </Field>
          )}
        />
        <Field>
          <Button type="submit" disabled={!form.formState.isDirty}>
            Save
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
})
