import { zodResolver } from '@hookform/resolvers/zod'
import {
  LockKeyholeIcon,
  RotateCcwKeyIcon,
  UnlockKeyholeIcon,
  UserLockIcon,
} from 'lucide-react'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { withExceptionCapturing } from '@/lib/utils'

import {
  ApiKeyVaultAuth,
  ApiKeyVaultAuthPromptSchema,
  IApiKeyVaultModel,
} from './model/ApiKeyVaultModel'
import { IChatWidgetModel } from './model/ChatbotWidgetModel'

export const ApiKeyVault = observer(function ({
  model,
}: {
  model: IChatWidgetModel
}) {
  const { apiKeyVault, settingsForm } = model
  const provider = settingsForm.settings.provider
  const [apiKey, setApiKey] = useState('')
  const saveKey = () => {
    apiKeyVault.set(provider, apiKey).catch(console.error)
  }
  return (
    <InputGroup>
      <InputGroupInput
        type="password"
        aria-label="API key"
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        placeholder={
          apiKeyVault.exists(provider)
            ? 'Modify saved key...'
            : apiKeyVault.status === 'locked'
              ? 'Set API key... (vault is locked)'
              : 'Add API key...'
        }
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label="Save API key"
          title="Save API key"
          onClick={saveKey}
          type="button"
        >
          Save
          {apiKeyVault.status === 'locked' ? (
            <LockKeyholeIcon />
          ) : (
            <UnlockKeyholeIcon />
          )}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
})

export const ApiKeyVaultAuthPrompt = observer(function ({
  model,
}: {
  model: IApiKeyVaultModel
}) {
  const status = model.status
  const form = useForm<ApiKeyVaultAuth>({
    resolver: zodResolver(ApiKeyVaultAuthPromptSchema),
    defaultValues: { password: '' },
  })
  const clearVault = () => {
    model.clear()
  }
  const onOpenChange = (open: boolean) => {
    if (!open) model.closePasswordPrompt()
  }
  const onSubmit = withExceptionCapturing(
    form.handleSubmit(({ password }: ApiKeyVaultAuth) => {
      model.inputPassword(password)
      form.reset()
    }),
  )
  return (
    <Dialog open={model.isAuthenticating} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>API Key Vault</DialogTitle>
              <DialogDescription>
                We encrypt your API keys locally in your browser using a
                password you provide. The password is never stored or
                transmitted. API keys are only shared with their associated LLM
                provider. Please ensure that you trust all loaded plugins and
                3rd party scripts in this JBrowse session before proceeding.
              </DialogDescription>
            </DialogHeader>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button variant="destructive" onClick={clearVault}>
                Clear All
              </Button>
              <Button type="submit">
                {status === 'locked' ? (
                  <>
                    Unlock
                    <UnlockKeyholeIcon />
                  </>
                ) : status === 'unset' ? (
                  <>
                    Create
                    <UserLockIcon />
                  </>
                ) : (
                  <>
                    Authenticate
                    <RotateCcwKeyIcon />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
})
