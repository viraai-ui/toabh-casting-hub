import React from 'react'
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
  Avatar,
  Card,
  CardContent,
  Stack,
  useMediaQuery,
  useTheme,
  CircularProgress,
  IconButton,
} from '@mui/material'
import { X, Edit2, Phone, MessageCircle, Mail } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { Casting } from '@/types'

interface TeamMemberInfo {
  id: number
  name: string
  role?: string
}

interface CastingDetailModalProps {
  open: boolean
  onClose: () => void
  onEdit: () => void
  casting: Casting | null
}

// Status color map (fallback colors if pipeline colors not available)
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  NEW: { bg: '#3b82f6', text: '#fff' },
  IN_PROGRESS: { bg: '#f59e0b', text: '#000' },
  REVIEW: { bg: '#8b5cf6', text: '#fff' },
  COMPLETED: { bg: '#22c55e', text: '#fff' },
  SHORTLISTED: { bg: '#06b6d4', text: '#fff' },
  CANCELLED: { bg: '#ef4444', text: '#fff' },
  OFFERED: { bg: '#ec4899', text: '#fff' },
  REJECTED: { bg: '#6b7280', text: '#fff' },
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <Card
      sx={{
        bgcolor: 'grey.900',
        border: '1px solid',
        borderColor: 'grey.800',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {children}
      </CardContent>
    </Card>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{
        color: 'grey.500',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontSize: '0.65rem',
        mb: 1,
        display: 'block',
      }}
    >
      {children}
    </Typography>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, py: 0.75 }}>
      <Typography
        variant="body2"
        sx={{
          color: 'grey.500',
          minWidth: 110,
          fontSize: '0.8rem',
          flexShrink: 0,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'grey.100',
          fontSize: '0.8rem',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

export function CastingDetailModal({
  open,
  onClose,
  onEdit,
  casting,
}: CastingDetailModalProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  if (!casting) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen={isMobile}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'grey.900',
            color: 'grey.100',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 300,
          }}
        >
          <CircularProgress sx={{ color: 'amber.500' }} />
        </Box>
      </Dialog>
    )
  }

  // Parse custom fields
  let parsedCustomFields: Record<string, string> = {}
  if (casting.custom_fields) {
    try {
      parsedCustomFields = JSON.parse(casting.custom_fields)
    } catch {
      parsedCustomFields = {}
    }
  }
  const customFieldEntries = Object.entries(parsedCustomFields).filter(
    ([, v]) => v !== '' && v !== null && v !== undefined
  )

  // Parse assigned_to
  const assignedTo: TeamMemberInfo[] = Array.isArray(casting.assigned_to)
    ? casting.assigned_to.map((m: any) => ({
        id: typeof m.id === 'string' ? parseInt(m.id) : m.id,
        name: m.name || '',
        role: m.role,
      }))
    : []

  // Budget display
  const hasBudget =
    (casting.budget_min != null && casting.budget_min > 0) ||
    (casting.budget_max != null && casting.budget_max > 0)

  // Phone number for call/whatsapp
  const phoneRaw = casting.client_contact || ''
  const phoneDigits = phoneRaw.replace(/\D/g, '')
  const phoneLink = phoneRaw.startsWith('+')
    ? `tel:${phoneRaw}`
    : `tel:+91${phoneDigits}`
  const waLink = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=Regarding ${encodeURIComponent(casting.project_name || 'your casting')}`
    : null

  // Status badge color
  const statusColor =
    STATUS_COLORS[casting.status?.toUpperCase()] || STATUS_COLORS.NEW

  // Format dates
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr || '—'
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'grey.900',
          color: 'grey.100',
          backgroundImage: 'none',
          maxHeight: isMobile ? '100%' : '90vh',
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: 'black/60',
            backdropFilter: 'blur(4px)',
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'grey.800',
          flexShrink: 0,
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: 'grey.400', '&:hover': { color: 'grey.100', bgcolor: 'grey.800' } }}
        >
          <X size={18} />
        </IconButton>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Edit2 size={14} />}
          onClick={onEdit}
          sx={{
            borderColor: 'grey.700',
            color: 'grey.300',
            textTransform: 'none',
            fontSize: '0.8rem',
            '&:hover': {
              borderColor: 'amber.500',
              color: 'amber.400',
              bgcolor: 'transparent',
            },
          }}
        >
          Edit
        </Button>
      </Box>

      {/* Scrollable content */}
      <DialogContent
        sx={{
          p: 0,
          px: 2.5,
          pb: 3,
          pt: 2.5,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {/* Title + Status */}
        <Box>
          <Typography
            variant="h6"
            sx={{
              color: 'amber.400',
              fontWeight: 700,
              fontSize: '1.1rem',
              lineHeight: 1.3,
              mb: 1,
            }}
          >
            {casting.project_name || '—'}
          </Typography>
          <Chip
            label={casting.status || '—'}
            size="small"
            sx={{
              bgcolor: statusColor.bg,
              color: statusColor.text,
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 22,
            }}
          />
        </Box>

        <Divider sx={{ borderColor: 'grey.800' }} />

        {/* CLIENT */}
        <Box>
          <SectionLabel>Client</SectionLabel>
          <SectionCard>
            <Box sx={{ p: 2 }}>
              <FieldRow label="Name" value={casting.client_name || '—'} />
              {casting.client_contact && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: 'grey.500', minWidth: 110, fontSize: '0.8rem', flexShrink: 0 }}
                  >
                    Phone
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: 'grey.100', fontSize: '0.8rem', mr: 1 }}
                  >
                    {casting.client_contact}
                  </Typography>
                  <Button
                    href={phoneLink}
                    component="a"
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    startIcon={<Phone size={12} />}
                    sx={{
                      minWidth: 0,
                      px: 1,
                      py: 0.25,
                      color: 'grey.400',
                      border: '1px solid',
                      borderColor: 'grey.700',
                      fontSize: '0.7rem',
                      textTransform: 'none',
                      '&:hover': { color: 'grey.100', borderColor: 'grey.500', bgcolor: 'grey.800' },
                    }}
                  >
                    Call
                  </Button>
                  {waLink && (
                    <Button
                      href={waLink}
                      component="a"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      startIcon={<MessageCircle size={12} />}
                      sx={{
                        minWidth: 0,
                        px: 1,
                        py: 0.25,
                        color: 'grey.400',
                        border: '1px solid',
                        borderColor: 'grey.700',
                        fontSize: '0.7rem',
                        textTransform: 'none',
                        '&:hover': { color: '#22c55e', borderColor: '#22c55e', bgcolor: 'rgba(34,197,94,0.1)' },
                      }}
                    >
                      WhatsApp
                    </Button>
                  )}
                </Box>
              )}
              {casting.client_email && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: 'grey.500', minWidth: 110, fontSize: '0.8rem', flexShrink: 0 }}
                  >
                    Email
                  </Typography>
                  <Button
                    href={`mailto:${casting.client_email}`}
                    component="a"
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    startIcon={<Mail size={12} />}
                    sx={{
                      minWidth: 0,
                      px: 1,
                      py: 0.25,
                      color: 'grey.400',
                      border: '1px solid',
                      borderColor: 'grey.700',
                      fontSize: '0.7rem',
                      textTransform: 'none',
                      '&:hover': { color: 'grey.100', borderColor: 'grey.500', bgcolor: 'grey.800' },
                    }}
                  >
                    {casting.client_email}
                  </Button>
                </Box>
              )}
              <FieldRow label="Company" value={casting.client_company || '—'} />
            </Box>
          </SectionCard>
        </Box>

        {/* DETAILS */}
        <Box>
          <SectionLabel>Details</SectionLabel>
          <SectionCard>
            <Box sx={{ p: 2 }}>
              <FieldRow
                label="Description"
                value={casting.requirements || '—'}
              />
              <FieldRow label="Location" value={casting.location || '—'} />
              <FieldRow
                label="Start Date"
                value={formatDisplayDate(casting.shoot_date_start)}
              />
              <FieldRow
                label="End Date"
                value={formatDisplayDate(casting.shoot_date_end)}
              />
              <FieldRow label="Lead Source" value={casting.source || '—'} />
            </Box>
          </SectionCard>
        </Box>

        {/* TEAM */}
        <Box>
          <SectionLabel>Team</SectionLabel>
          <SectionCard>
            <Box sx={{ p: 2 }}>
              {assignedTo.length === 0 ? (
                <Typography
                  variant="body2"
                  sx={{ color: 'grey.600', fontSize: '0.8rem', fontStyle: 'italic' }}
                >
                  —
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {assignedTo.map((member) => (
                    <Box
                      key={member.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 0.5,
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 28,
                          height: 28,
                          bgcolor: 'amber.600',
                          color: 'white',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                        }}
                      >
                        {getInitials(member.name)}
                      </Avatar>
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{ color: 'grey.100', fontSize: '0.8rem', lineHeight: 1.2 }}
                        >
                          {member.name}
                        </Typography>
                        {member.role && (
                          <Typography
                            variant="caption"
                            sx={{ color: 'grey.500', fontSize: '0.7rem' }}
                          >
                            {member.role}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </SectionCard>
        </Box>

        {/* BUDGET */}
        {hasBudget && (
          <Box>
            <SectionLabel>Budget</SectionLabel>
            <SectionCard>
              <Box sx={{ p: 2 }}>
                {casting.budget_min != null && casting.budget_min > 0 && (
                  <FieldRow
                    label="Budget Min"
                    value={`₹${casting.budget_min.toLocaleString('en-IN')}`}
                  />
                )}
                {casting.budget_max != null && casting.budget_max > 0 && (
                  <FieldRow
                    label="Budget Max"
                    value={`₹${casting.budget_max.toLocaleString('en-IN')}`}
                  />
                )}
                {casting.budget_min != null &&
                  casting.budget_max != null &&
                  casting.budget_min > 0 &&
                  casting.budget_max > 0 && (
                    <Box sx={{ mt: 0.5, px: 0.5 }}>
                      <Typography
                        variant="caption"
                        sx={{ color: 'grey.500', fontSize: '0.7rem' }}
                      >
                        {`₹${casting.budget_min.toLocaleString('en-IN')} – ₹${casting.budget_max.toLocaleString('en-IN')}`}
                      </Typography>
                    </Box>
                  )}
              </Box>
            </SectionCard>
          </Box>
        )}

        {/* CUSTOM FIELDS */}
        {customFieldEntries.length > 0 && (
          <Box>
            <SectionLabel>Custom Fields</SectionLabel>
            <SectionCard>
              <Box sx={{ p: 2 }}>
                {customFieldEntries.map(([key, value]) => (
                  <FieldRow
                    key={key}
                    label={key.replace(/_/g, ' ')}
                    value={String(value)}
                  />
                ))}
              </Box>
            </SectionCard>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
