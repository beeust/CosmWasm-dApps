import { BackButton, Loading, OperationResultState, PageLayout } from "@cosmicdapp/design";
import { getErrorFromStackTrace, useAccount, useSdk } from "@cosmicdapp/logic";
import { Decimal } from "@cosmjs/math";
import { Button, Typography } from "antd";
import { Formik } from "formik";
import { Form, FormItem, Input } from "formik-antd";
import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import backArrowIcon from "../../assets/backArrow.svg";
import { addAllowanceValidationSchema } from "../../forms/validationSchemas";
import { pathAllowances, pathOperationResult, pathTokens } from "../../paths";
import { CW20 } from "../../service/cw20";
import { Amount, FormFieldsStack, FormStack, MainStack } from "./style";

const { Title, Text } = Typography;

interface FormAddAllowanceFields {
  readonly address: string;
  readonly amount: string;
}

interface AllowanceAddParams {
  readonly contractAddress: string;
}

function AllowanceAdd(): JSX.Element {
  const [loading, setLoading] = useState(false);

  const history = useHistory();
  const { getClient } = useSdk();
  const { account } = useAccount();

  const { contractAddress }: AllowanceAddParams = useParams();

  const [tokenName, setTokenName] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState(0);

  useEffect(() => {
    const cw20Contract = CW20(getClient()).use(contractAddress);

    cw20Contract.tokenInfo().then((tokenInfo) => {
      setTokenName(tokenInfo.symbol);
      setTokenDecimals(tokenInfo.decimals);
    });
  }, [getClient, contractAddress]);

  const submitAddAllowance = (values) => {
    setLoading(true);

    const { address: spenderAddress, amount: newAmount }: FormAddAllowanceFields = values;

    const cw20Contract = CW20(getClient()).use(contractAddress);

    cw20Contract.allowance(account.address, spenderAddress).then(({ allowance }) => {
      const decNewAmount = Decimal.fromAtomics(newAmount, tokenDecimals);
      const decCurrentAmount = Decimal.fromAtomics(allowance, tokenDecimals);

      try {
        let allowanceOperation: Promise<string> = Promise.reject("");

        if (decNewAmount.isGreaterThan(decCurrentAmount)) {
          allowanceOperation = cw20Contract.increaseAllowance(
            spenderAddress,
            decNewAmount.minus(decCurrentAmount).toString(),
          );
        } else {
          allowanceOperation = cw20Contract.decreaseAllowance(
            spenderAddress,
            decCurrentAmount.minus(decNewAmount).toString(),
          );
        }

        allowanceOperation.then(() => {
          history.push({
            pathname: pathOperationResult,
            state: {
              success: true,
              message: `${newAmount} ${tokenName} allowance for ${spenderAddress} succesfully added `,
              customButtonText: "Tokens",
            } as OperationResultState,
          });
        });
      } catch (stackTrace) {
        console.error(stackTrace);

        history.push({
          pathname: pathOperationResult,
          state: {
            success: false,
            message: "Could not set allowance:",
            error: getErrorFromStackTrace(stackTrace),
            customButtonActionPath: `${pathAllowances}/${contractAddress}`,
          } as OperationResultState,
        });
      }
    });
  };

  return (
    (loading && <Loading loadingText={`Adding allowance...`} />) ||
    (!loading && (
      <PageLayout>
        <MainStack>
          <BackButton icon={backArrowIcon} path={pathTokens} />
          <Title>Add Allowance</Title>
          <Formik
            initialValues={{ address: "", amount: "" } as FormAddAllowanceFields}
            onSubmit={submitAddAllowance}
            validationSchema={addAllowanceValidationSchema}
          >
            {(formikProps) => (
              <Form>
                <FormStack>
                  <FormFieldsStack>
                    <FormItem name="address">
                      <Input name="address" placeholder="Enter address" />
                    </FormItem>
                    <Amount>
                      <FormItem name="amount">
                        <Input name="amount" placeholder="Enter amount" />
                      </FormItem>
                      <Text>{tokenName}</Text>
                    </Amount>
                  </FormFieldsStack>
                  <Button
                    type="primary"
                    onClick={formikProps.submitForm}
                    disabled={!(formikProps.isValid && formikProps.dirty)}
                  >
                    Confirm
                  </Button>
                </FormStack>
              </Form>
            )}
          </Formik>
        </MainStack>
      </PageLayout>
    ))
  );
}

export default AllowanceAdd;
