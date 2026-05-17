import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import type { DashboardCustomWidget } from '@/contexts/DashboardLayoutContext'
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext'

interface CustomDashboardWidgetProps {
  widget: DashboardCustomWidget
}

interface WidgetEditorDialogProps {
  widget: DashboardCustomWidget
  onClose: () => void
}

const inlinePattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g

const renderInline = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = []
  let lastIndex = 0

  text.replace(inlinePattern, (match, _token: string, offset: number) => {
    if (offset > lastIndex) {
      nodes.push(text.slice(lastIndex, offset))
    }

    if (match.startsWith('`')) {
      nodes.push(
        <Box
          key={`${offset}-code`}
          component="code"
          sx={{
            px: 0.5,
            py: 0.1,
            borderRadius: 0.5,
            bgcolor: 'action.hover',
            fontSize: '0.9em',
          }}
        >
          {match.slice(1, -1)}
        </Box>
      )
    } else if (match.startsWith('**')) {
      nodes.push(<Box key={`${offset}-strong`} component="strong">{match.slice(2, -2)}</Box>)
    } else if (match.startsWith('*')) {
      nodes.push(<Box key={`${offset}-em`} component="em">{match.slice(1, -1)}</Box>)
    } else {
      const linkMatch = match.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        nodes.push(
          <Box
            key={`${offset}-link`}
            component="a"
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'primary.main' }}
          >
            {linkMatch[1]}
          </Box>
        )
      }
    }

    lastIndex = offset + match.length
    return match
  })

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function MarkdownView({ value }: { value: string }) {
  const blocks = useMemo(() => {
    const lines = value.split(/\r?\n/)
    const renderedBlocks: ReactNode[] = []
    let codeBuffer: string[] = []
    let inCode = false

    lines.forEach((line, index) => {
      if (line.trim().startsWith('```')) {
        if (inCode) {
          renderedBlocks.push(
            <Box
              key={`code-${index}`}
              component="pre"
              sx={{
                m: 0,
                mb: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: 'action.hover',
                overflow: 'auto',
                fontSize: '0.82rem',
              }}
            >
              {codeBuffer.join('\n')}
            </Box>
          )
          codeBuffer = []
          inCode = false
        } else {
          inCode = true
        }
        return
      }

      if (inCode) {
        codeBuffer.push(line)
        return
      }

      if (!line.trim()) {
        renderedBlocks.push(<Box key={`space-${index}`} sx={{ height: 8 }} />)
        return
      }

      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
      if (headingMatch) {
        const level = headingMatch[1].length
        renderedBlocks.push(
          <Typography
            key={`heading-${index}`}
            variant={level === 1 ? 'h6' : 'subtitle1'}
            fontWeight={700}
            sx={{ mb: 0.75, lineHeight: 1.25 }}
          >
            {renderInline(headingMatch[2])}
          </Typography>
        )
        return
      }

      const listMatch = line.match(/^\s*[-*]\s+(.+)$/)
      if (listMatch) {
        renderedBlocks.push(
          <Typography
            key={`li-${index}`}
            component="li"
            variant="body2"
            sx={{ ml: 2.2, mb: 0.35, lineHeight: 1.45 }}
          >
            {renderInline(listMatch[1])}
          </Typography>
        )
        return
      }

      const quoteMatch = line.match(/^>\s+(.+)$/)
      if (quoteMatch) {
        renderedBlocks.push(
          <Typography
            key={`quote-${index}`}
            variant="body2"
            color="text.secondary"
            sx={{
              pl: 1.2,
              mb: 0.5,
              borderLeft: 3,
              borderColor: 'divider',
              lineHeight: 1.45,
            }}
          >
            {renderInline(quoteMatch[1])}
          </Typography>
        )
        return
      }

      renderedBlocks.push(
        <Typography key={`p-${index}`} variant="body2" sx={{ mb: 0.6, lineHeight: 1.5 }}>
          {renderInline(line)}
        </Typography>
      )
    })

    if (inCode && codeBuffer.length > 0) {
      renderedBlocks.push(
        <Box key="code-tail" component="pre" sx={{ m: 0, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
          {codeBuffer.join('\n')}
        </Box>
      )
    }

    return renderedBlocks
  }, [value])

  return <>{blocks}</>
}

function WidgetEditorDialog({ widget, onClose }: WidgetEditorDialogProps) {
  const { updateCustomWidget } = useDashboardLayout()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [title, setTitle] = useState(widget.title)
  const [content, setContent] = useState(widget.content)

  const handleSave = () => {
    updateCustomWidget(widget.id, { title, content })
    onClose()
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setContent(reader.result)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{widget.type === 'image' ? '图片框' : '文字框'}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <TextField
          label="标题"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          fullWidth
          margin="dense"
        />
        {widget.type === 'image' ? (
          <>
            <TextField
              label="图片地址"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              fullWidth
              margin="dense"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileChange}
            />
            <Button sx={{ mt: 1 }} onClick={() => fileInputRef.current?.click()}>
              选择图片
            </Button>
          </>
        ) : (
          <TextField
            label="Markdown"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            fullWidth
            multiline
            minRows={10}
            margin="dense"
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  )
}

export function CustomDashboardWidget({ widget }: CustomDashboardWidgetProps) {
  const { editingWidgetId, setEditingWidgetId } = useDashboardLayout()
  const open = editingWidgetId === widget.id
  const handleClose = () => setEditingWidgetId(null)

  return (
    <>
      <Card sx={{ height: '100%' }}>
        <CardContent
          sx={{
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            p: widget.type === 'image' ? 1.25 : 2,
            '&:last-child': { pb: widget.type === 'image' ? 1.25 : 2 },
          }}
        >
          {widget.title && (
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: widget.type === 'image' ? 1 : 1.2, flex: '0 0 auto' }}
            >
              {widget.title}
            </Typography>
          )}

          {widget.type === 'image' ? (
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              {widget.content && (
                <Box
                  component="img"
                  src={widget.content}
                  alt={widget.title}
                  sx={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    minWidth: 0,
                    minHeight: 0,
                    objectFit: 'contain',
                    objectPosition: 'center center',
                  }}
                />
              )}
            </Box>
          ) : (
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <MarkdownView value={widget.content} />
            </Box>
          )}
        </CardContent>
      </Card>

      {open && <WidgetEditorDialog widget={widget} onClose={handleClose} />}
    </>
  )
}
