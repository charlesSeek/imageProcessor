DEPLOYMENT_BUCKET ?= myadbox-lambda-deployments
ENV ?= dev
STACK_NAME ?= image-processor-$(ENV)

clean: output.json
	rm -rf $<

deploy:
	rm -rf output.json
	aws cloudformation package --template-file template.json --output-template-file output.json --s3-bucket $(DEPLOYMENT_BUCKET) --use-json
	aws cloudformation deploy --template-file output.json --stack-name $(STACK_NAME) --capabilities CAPABILITY_IAM --parameter-overrides StageName=$(ENV)