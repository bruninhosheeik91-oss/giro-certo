import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider, useApp } from '../context/AppContext';
import { PayablesModal } from './PayablesModal';

const Harness: React.FC = () => {
  const { openPayablesModal, transactions } = useApp();
  const linkedExpenses = transactions.filter((transaction) => transaction.payableInstallmentId);
  return (
    <>
      <button type="button" onClick={openPayablesModal}>
        Abrir contas
      </button>
      <output data-testid="linked-expenses">{linkedExpenses.length}</output>
      <PayablesModal />
    </>
  );
};

describe('PayablesModal flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a bill and records exactly one expense when it is paid', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <Harness />
      </AppProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Abrir contas' }));
    await user.click(screen.getByRole('button', { name: 'Cadastrar primeira conta' }));
    await user.type(screen.getByLabelText('Nome da conta'), 'Seguro anual');
    await user.selectOptions(screen.getByLabelText('Tipo da conta'), 'conta_unica');
    await user.type(screen.getByLabelText('Valor da conta'), '10000');
    fireEvent.change(screen.getByLabelText('Primeiro vencimento'), {
      target: { value: '2026-09-25' },
    });
    await user.click(screen.getByRole('button', { name: 'Cadastrar conta' }));

    expect(await screen.findByText('Vencimento único')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Marcar como paga' }));
    fireEvent.change(screen.getByLabelText('Data do pagamento'), {
      target: { value: '2026-09-23' },
    });
    await user.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() => expect(screen.getByTestId('linked-expenses')).toHaveTextContent('1'));
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeInTheDocument();
  });
});
